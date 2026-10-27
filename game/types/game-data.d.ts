// Phase 04e: the game data's format, for the type check (npm run typecheck). Types only: nothing here runs.
// The data is the JSON files in game/data (index.json lists them), put together as window.GAMEDATA by
// tools/build-data.mjs, or by js/data-fallback.js from the files themselves. The schemas in game/data/schema check
// the files (npm run check:data); these types check the code that reads them.
// Precise where the code reads a field. Loose (an index signature) where only the Studio or one renderer reads the
// rest: the maps, the props, the wardrobe, the engine settings. Keys are the final phase 05 names (locations, roads,
// battleStages, maps; locationId, mapId, battleStage, model).
// The two whose plain name is a built-in type say Data: MapData (Map) and LocationData (Location).

/** an id with a file of its own or a key in a section: lowercase [a-z0-9_] (data-files.js refuses anything else) */
export type DataId = string;
/** a species: its line's id and its stage, 'musk0', 'musk1'; a split line's finals are 2 and 3 */
export type SpeciesId = string;
/** a key of gameData.moves */
export type MoveId = string;
/** a type's id: 'Fire', 'Water'... ('None' for a move or a Billie without one) */
export type TypeId = string;
/** a stat's id, in gameData.stats order: 'hp', 'lev', 'law', 'lob', 'pr', 'hus' */
export type StatId = string;
/** a location's position in gameData.locations: saves, trainers and roads name locations by it */
export type LocationNode = number;
/** a ground kind: one character, a key of gameData.scenery.terrains */
export type TerrainKey = string;
/** a colour, '#RGB' or '#RRGGBB' */
export type Color = string;
/** [species, weight] in an encounter list */
export type WeightedSpecies = [species: SpeciesId, weight: number];

/** window.GAMEDATA: every section, in index.json order */
export interface GameData {
  roster: RosterEntry[];
  meta: Meta;
  types: BillyType[];
  untyped: Untyped;
  stats: { id: StatId; name: string }[];
  statuses: { id: string; name: string }[];
  moves: Record<MoveId, Move>;
  /** phase 17: robot parts and gems */
  robots?: RobotData;
  /** phase 07: talking-head portraits (game/data/portraits.json) */
  portraits?: PortraitData;
  rarities: Record<string, { totals: number[] }>;
  /** studio track ST-0: a Billie's coat, a recolour in place of the old Golden sheets (game/data/coats.json) */
  coats?: Record<DataId, Coat>;
  /** studio track ST-3: the phase 16 part kits, sliced by the Studio's Art workbench (game/data/partKits.json) */
  partKits?: PartKits;
  /** Studio plan Phase 5 (T5.1): the kit Billies' recipes, baked by logic/kit-assemble.js (game/data/kitBuilds.json) */
  kitBuilds?: KitBuilds;
  /** roster track RO-3a: the body plans and the placeholder Billies, baked by logic/placeholder-art.js
   * (game/data/bodyPlans.json; its shapes are typed there as BodyPlans) */
  bodyPlans?: import('../js/logic/placeholder-art.js').BodyPlans;
  /** splicing track SP-2: Genes (game/data/genes.json; logic/genes.js) */
  genes?: Genes;
  /** phase 10: the world map's look: the sea, the relief, each region's ground and trees (game/data/worldmap.json) */
  worldmap?: WorldMapLook;
  /** map generator MG-1: the generator's recipe per biome (game/data/biomes.json) */
  biomes?: Record<DataId, Biome>;
  /** roguelite track RL-6: the kinds of node on a run's map (game/data/nodeTypes.json; logic/run-map.js) */
  nodeTypes?: Record<DataId, NodeType>;
  /** sound track SND-2: the songs, jingles, cries' bases and where each song plays (game/data/music.json) */
  music?: Music;
  /** roguelite track RL-12: a run's Perks, each a list of effect rows (game/data/perks.json; logic/effects.js) */
  perks?: Record<DataId, Perk>;
  /** RL-12b: events.json */
  events?: EventsData;
  /** RL-S1: the story director's lines */
  banter?: Record<DataId, BanterLine>;
  /** RL-S2: the hub folk and you (relations.json) */
  relations?: RelationsData;
  /** ON-3: the Showcase's weekly themes and ribbons (game/data/showcase.json) */
  showcase?: ShowcaseData;
  /** RL-12b: rewards.json */
  rewards?: Record<DataId, RewardRow>;
  /** roguelite track RL-11: the four currencies (game/data/currencies.json) */
  currencies?: Partial<Record<CurrencyId, Currency>>;
  /** RL-11: Copperleaf's hub buildings (game/data/buildings.json) */
  buildings?: Record<DataId, HubBuilding>;
  /** RL-11: the one unlock table (game/data/unlocks.json; logic/unlocks.js) */
  unlocks?: Record<DataId, Unlock>;
  /** UI track UI-1: the UI's look: palette, glass, cuts, fonts (game/data/uiTheme.json; logic/ui-theme.js) */
  uiTheme?: UiTheme;
  lines: Line[];
  /** the world map's places, in node order */
  locations: LocationData[];
  /** RL-R1: the run's region themes (logic/run-region.js) */
  regions: RegionsData;
  /** RL-R2: the field moves that open a run's side areas */
  fieldMoves?: { about?: string; moves: Record<DataId, FieldMove>; waterfall?: FieldClimb };
  /** RT-3: set pieces, prop groups placed as a unit on a laid-out place */
  setPieces?: SetPiecesData;
  /** WM-7: the leaders' arenas */
  arenas?: ArenasData;
  /** RL-13: a run's Expeditions and challenges */
  modifiers?: ModifiersData;
  /** RL-14: the runs' enemy factions and their bots */
  factions?: { about?: string; factions: Record<DataId, Faction> };
  /** RL-14b: a run's bosses that are not a leader's Billie (the Voltron) */
  bosses?: { about?: string; bosses: Record<DataId, BossDef> };
  /** TW-3: a run's quests */
  quests?: QuestsData;
  /** residents track RS-1: the people a run can invite to Copperleaf (game/data/residents.json; logic/residents.js) */
  residents?: Record<DataId, Resident>;
  /** HB-10e: Copperleaf's festivals and market days (game/data/festivals.json; logic/festival.js) */
  festivals?: FestivalsData;
  pools: Record<DataId, Pool>;
  pyramids: Record<DataId, Coin>;
  items: Record<DataId, Item>;
  people: Record<DataId, Person>;
  trainers?: Record<DataId, Trainer>;
  rules: Rules;
  battleStages: Record<DataId, BattleStage>;
  scenery: Scenery;
  /** LD-1: what tools/bake-pixel-facts.mjs read out of pictures' pixels: the flat grass props' lightness by picture,
      and the leaf clumps' baked cuts (logic/pixel-facts.js leafCutKey -> an art path) */
  pixelFacts?: { lightness: Record<string, number>; cuts: Record<string, string> };
  /** every walkable map: towns, routes, rooms (int_*) and test maps (test_*) */
  maps: Record<DataId, MapData>;
  /** the walking network between the locations; a world without roads has none (RL-5: no chain made up) */
  roads?: RoadLink[];
  engine: Engine;
  wardrobe: Wardrobe;
  /** fishing spots' encounter lists, keyed by the water ('pond', 'sea'...) */
  fishing: Record<string, Pool>;
  moods: Record<DataId, Mood>;
  lore: Lore;
  /** Project Story: the story layer's flags, speakers, quests and start presets */
  story: StoryData;
  /** cutscenes, one file each (game/data/cutscenes/<id>.json, docs/CUTSCENES.md) */
  cutscenes?: Record<DataId, CutsceneData>;
}

/* ---------- the files: index.json and the split sections ---------- */

/** game/data/index.json (index.schema.json) */
export interface DataIndex {
  /** the sections in order; a section not in split is <section>.json */
  keys: string[];
  /** the sections with a file per entry, <section>/<id>.json, in the order of ids */
  split: Record<string, { array?: true; ids: DataId[] }>;
}

/** self.PB_DATA: the files' layout and format (game/js/data-files.js; the build, the game and the Studio share it) */
export interface DataFiles {
  /** the sections with a file per entry: a list (each entry has an id) or an object (the key is the id) */
  SPLIT: Record<string, 'array' | 'object'>;
  /** index.json -> every file, in load order */
  files(index: DataIndex): { section: string; id: DataId | null; path: string }[];
  /** read(path) -> the parsed file; returns the whole game data */
  assemble(index: DataIndex, read: (path: string) => any): GameData;
  /** the whole game data -> index.json and every file's value, by path */
  split(data: Record<string, any>): { index: DataIndex; files: Record<string, unknown> };
  /** JSON in the files' layout (one-space indent, short values and lists of numbers on one line) */
  format(value: unknown, pad?: string): string;
  /** format() and a newline: a file's whole text */
  text(value: unknown): string;
  /** phase 08b: a road of D.roads, read the same whatever shape roads.json has */
  road(data: Record<string, any>, road: any): RoadView;
  /** set one end of a road: its place (null keeps it) and its exit (undefined keeps it, null clears it) */
  setRoadEnd(
    data: Record<string, any>,
    road: any,
    end: 'a' | 'b',
    node: LocationNode | null,
    exit?: string | null
  ): void;
  /** a new road between two places, added to data.roads */
  addRoad(data: Record<string, any>, a: LocationNode, b: LocationNode): any;
  /** phase 08b: the room for what a door does (shop, clinic, lab, house, home) */
  ROOM_BY_USE: Record<string, string>;
  /** the rooms a building's door may lead to, in order: its own, its kind's, the one for what it does */
  doorRooms(p: any, kind: any, act: string | null): string[];
}

/** a road as PB_DATA.road() reads it: its two places (nodes) and the exit each leaves by */
export interface RoadView {
  a: LocationNode;
  b: LocationNode;
  exitA: string | null;
  exitB: string | null;
  id: string | null;
  name: string | null;
  kind: 'seam' | 'lift';
}

/* ---------- Billies: types, stats, moves, lines ---------- */

export interface Meta {
  title: string;
  version: number;
  dataVersion: number;
  notes: string;
  worldV24?: number;
}

/** types.json: a Billie type, its colours and matchups */
export interface BillyType {
  id: TypeId;
  color: Color;
  /** the text colour on it (default '#fff') */
  text?: Color;
  /** the types it hits for double damage */
  strong?: TypeId[];
  /** the types that resist it */
  weak?: TypeId[];
  /** a battle rule its Billies share ('' for none) */
  passive?: string;
  /** RF-3: the passive's name and what it does, as the player reads them */
  passiveName?: string;
  passiveText?: string;
  /** hit effects (default pow, star) */
  fx?: string[];
}

/** untyped.json: the colours and hit effects of 'None' */
export interface Untyped {
  color: Color;
  text?: Color;
  fx?: string[];
}

/** moves.json: a move */
export interface Move {
  /** name */
  n: string;
  /** type (unknown types become 'None' at load) */
  t: TypeId;
  /** category: 'H' physical (Attack against Defense), 'S' special, 'X' status (no damage) */
  c: 'H' | 'S' | 'X';
  /** power */
  p?: number;
  /** accuracy, percent (100 when missing, filled in at load) */
  a: number;
  /** description */
  d: string;
  /** priority */
  pr?: number;
  fx?: MoveEffect;
  /** the line whose signature move it is */
  sig?: string;
}

export interface MoveEffect {
  protect?: number;
  status?: string;
  selfStatus?: string;
  chance?: number;
  selfChance?: number;
  selfStage?: Partial<Record<StatId, number>>;
  tgtStage?: Partial<Record<StatId, number>>;
  drain?: number;
  heal?: number;
  hype?: number;
  wipe?: number;
  market?: string;
  spread?: number;
  vary?: string;
  delay?: number;
  crit?: number;
  spin?: number;
  /** RO-3f: Fork: the user takes the target's types for battle.forkTurns turns */
  copyTypes?: number;
  hold?: number;
  missCost?: number;
  stones?: number;
  /** phase 17: the attacker picks which part of a robot it hits */
  aim?: number;
  /** phase 17: a robot part hit by it loses this many times the usual part damage */
  breaker?: number;
  /** phase 17: restores this share of the user's robot parts' HP */
  repair?: number;
}

/** an evolution. The data uses 'lvl' (at a level) and 'split' (a split line's middle stage, by the Hype/Build rule);
    the code still knows the older kinds (game-state.js canEvolve, evolutionHint) */
export type Evolution =
  | { k: 'lvl' | 'split'; at: number }
  | { k: 'item'; item?: DataId; min: number }
  | { k: 'idle'; ms: number; min: number }
  | { k: 'streak' | 'donate'; n: number; min: number }
  | { k: 'merge' | 'rename'; min: number };

/** lines/<id>.json (line.schema.json): a Billie line, a species per stage; per-stage lists repeat their last entry */
export interface Line {
  id: DataId;
  /** a name per stage */
  names: string[];
  /** the types of each stage */
  types: TypeId[][];
  /** the six stat weights, hp first, then the others in stats order */
  prof: number[];
  /** a key of gameData.rarities */
  rar: string;
  /** [level, move] pairs (unknown moves are dropped at load) */
  learn: [level: number, move: MoveId][];
  evo?: Evolution[];
  /** four names: stages 1, 2 and two finals (3A, 3B) */
  split?: boolean;
  parody: string;
  /** base stats per stage (else made from prof and the rarity's totals) */
  base?: number[][];
  /** RO-2c: this line's own stat total per stage, in place of its rarity's (rarities.json) */
  totals?: number[];
  catchRate?: number;
  cat?: string[];
  ht?: number[];
  wt?: number[];
  hab?: string[];
  diet?: string[];
  bio?: string[];
  note?: string[];
  /** phase 16: each stage's native parts (its fitting set): a kit part id (partKits.json) per part slot */
  parts?: Record<string, string>[];
  /** SND-3: each stage's cry (null: the one its id makes) */
  cry?: (SpeciesCry | null)[];
  /** RO-1: regional forms of the whole line (logic/forms.js) */
  forms?: LineForm[];
}

/** RO-1: a line's regional form: a coat (coats.json, marked form) and a type swap; each stage is a species
    <line>_<id><stage> named "<name> <stage name>" (logic/forms.js) */
export interface LineForm {
  id: DataId;
  /** the regional word before each stage's name */
  name: string;
  /** a type for a type, on every stage: { Ground: 'Water' } */
  swap: Record<TypeId, TypeId>;
  /** its look: a coats.json id marked form */
  coat: DataId;
}

/** SND-3: a species' own cry: a base (music.json cries.bases), the first note's pitch (midi) and a length (1 as made
    from the id); a key left out comes from the id (logic/cries.js) */
export interface SpeciesCry {
  base?: number;
  pitch?: number;
  length?: number;
}

/** a species, made from its line at load (game-data.js SPECIES) */
export interface Species {
  id: SpeciesId;
  name: string;
  line: DataId;
  /** 0, 1, 2 (a split line's two finals are both 2) */
  stage: number;
  types: TypeId[];
  /** base stats, in stats order */
  base: number[];
  cat: string;
  ht: number;
  wt: number;
  hab: string;
  diet: string;
  blurb: string;
  note: string;
  /** catch rate */
  cr: number;
  /** XP yield */
  yld: number;
  /** the next stage, or null for a final one */
  next: SpeciesId | null;
  /** a split line's other final (on the middle stage) */
  alt: SpeciesId | null;
  evo: Evolution | null;
  /** its number in the Guide's list of Billies, from 1 */
  no: number;
  rar: string;
  /** a split line's finals: 'A' (Build) or 'B' (Hype) */
  form: 'A' | 'B' | null;
  /** SND-3: its own cry, or null for the one its id makes */
  cry: SpeciesCry | null;
  /** RO-1: a regional form's base stage (its art and dex entry); none on a line's own stages */
  formOf?: SpeciesId;
  /** RO-1: a regional form's coat, given to every Billie of it */
  coat?: DataId;
}

/** roster.json: the art and design state of each species (the Studio's Billies section) */
export interface RosterEntry {
  id: string;
  name: string;
  no: number;
  line: DataId;
  stage: number;
  kind: string;
  parody: string;
  types: TypeId[];
  design: string;
  state: Record<string, boolean>;
  split?: string;
}

/* ---------- the world: locations, roads, regions, maps ---------- */

/** phase 10: a place on the bowl, seen from above. a: degrees counter-clockwise from east; r: 0 at the centre of
 * the floor, 1 at the rim. A place reached only by lift (Pearlantis) sits under another place instead. RL-8b: up, the
 * way its map's north faces (degrees like a; 90 the bowl's north); without it the map's north faces the centre; off,
 * not on this world's map (Copperleaf during a run: no land, pin, things or weather of its own). */
export type BowlSpot = { a: number; r: number; up?: number; off?: boolean } | { under: DataId };

/** locations.json: a place on the world map (a town or a route area), in node order */
export interface LocationData {
  /** the same id as its map */
  id: DataId;
  name: string;
  /** its walkable map, a key of gameData.maps */
  mapId: DataId;
  kind: 'town' | 'route';
  /** the older town flag (kind says the same) */
  town?: number;
  /** the label under its name: 'Route 2', 'Town' */
  route: string;
  routeName?: string;
  /** its encounter pool, a key of gameData.pools (an unknown one becomes the first pool at load) */
  pool: DataId;
  /** its battle stage, a key of gameData.battleStages (filled in at load when unknown) */
  battleStage: DataId;
  t: string;
  biome: string;
  mood: DataId;
  blurb: string;
  /** phase 10: where it sits on the bowl world map */
  bowl: BowlSpot;
  region?: string;
  music?: string;
  /** a key of SHOPS */
  shop?: DataId;
  boutique?: string;
  /** a gym badge (a trainer's seat id) needed to go on */
  gate?: string;
  gateText?: string;
  /** Project Story S2: closed until this condition holds (docs/SCRIPTS.md), and what you are told meanwhile */
  requires?: string;
  locked?: string;
  ride?: number;
  noFly?: number;
  /** roguelite track RL-7: a run's place: its node on the run's map (logic/run-scenes.js; world node runNode + 1) */
  runNode?: number;
  /** RT-2: a run route's trainers (a pair is two; logic/route-trainers.js routeTrainerTally): its wild stock is less */
  trainerCount?: number;
  /** RT-4: where a run route's rarer one waits (a free pocket or dead end: logic/route-trainers.js routeRareSpots) */
  rareAt?: [number, number];
  /** RL-R2: a side area's first place: closed until the run's field move obstacle (this move) is open */
  field?: DataId;
  /** RL-R2: 1 on a side area's place */
  side?: 1;
  /** RL-12b: 1 on a run's waystation (an event's or a stall's place): fewer wild Billies (rules.json run.wild) */
  waystation?: 1;
  /** WA-5a: a run's place with marsh or bog water: its wild Billies weighted toward the marsh's (logic/water-play.js) */
  marsh?: string;
  v47region?: number;
  a04place?: number;
  a04pearl?: number;
}

/** what game-data.js adds to each location at load */
export interface LocationEntry extends LocationData {
  /** the trainers who wait here, in data order */
  trainers: DataId[];
  /** the first of them who hands out a badge (its gym), or null */
  board: DataId | null;
}

/** roads.json (phase 08b): a typed link between two places, each end naming a place by its map (the place's mapId,
    or its id when it has none) and the edge exit it leaves by. The Studio and the tools read it through
    PB_DATA.road(); the game through ROADS */
export interface RoadLink {
  /** 'road:<a's id>-<b's id>' */
  id?: string;
  name?: string;
  /** 'seam': the two places' edges meet at the exits; 'lift': the glass lift (no exits; the lift props' `to`) */
  kind?: 'seam' | 'lift';
  a: { map: DataId; exit?: string };
  b: { map: DataId; exit?: string };
}

/** a road as the game reads it (game-data.js ROADS): [from node, to node, length in metres (roadMetres), the two
    ends] */
export type Road = [from: LocationNode, to: LocationNode, length: number, ends?: RoadEnds];

/** a road as one end sees it (game-data.js ROADS_BY_NODE): the other end, the length and the road's index */
export interface RoadFromNode {
  to: LocationNode;
  cost: number;
  i: number;
}

/** which exit of each end's map a road leaves by */
export interface RoadEnds {
  /** the exit (an edgeExits id) on the from side */
  a: string;
  /** the exit on the to side */
  b: string;
  /** 'road:<from id>-<to id>' */
  id: string;
  from: DataId;
  to: DataId;
  name: string;
}

/** TW-2: rules.json run.town */
export interface RunTownRules {
  locals: [number, number];
  names: string[];
  chat: Record<DataId, string[]>;
}

/** RL-R1: a region theme (regions.json themes): where its zones start, the biomes it walks through, the types it
 * leans to (its dex's lines and its leaders) and its own name endings and nouns */
export interface RegionTheme {
  name: string;
  weight?: number;
  /** the first zone's biome, by weight */
  start: Record<DataId, number>;
  /** its biomes' weights, times the graph's, for each next zone */
  biomes: Record<DataId, number>;
  /** a type's lean (types.json ids) */
  types: Record<string, number>;
  ends?: string[];
  nouns?: string[];
  /** HB-7: its sky train from Skyline Station: the prop (scenery.json, group sky_train) and its name */
  train?: { k: string; name: string };
}

/** RL-R1: regions.json, what a run's region is made from (logic/run-region.js runRegionMake) */
export interface RegionsData {
  /** the zones a region has at each Expedition (I first) */
  zones: number[];
  /** a zone's rows on the run's map, fewest and most */
  rows: [number, number];
  /** the regional dex's species, fewest and most */
  dex: [number, number];
  /** the biome graph: each biome's likely next ones, by weight */
  graph: Record<DataId, Record<DataId, number>>;
  themes: Record<DataId, RegionTheme>;
  /** the shared name parts: parts, endings joined on (a part + 'vale'), nouns after a space, the odds of joining */
  names: { parts: string[]; ends: string[]; nouns: string[]; joined: number };
}

/** a point on a map, metres: [x, z] */
export type MapPoint = [x: number, z: number, ...rest: number[]];

/** maps/<id>.json (map.schema.json): a walkable map. gamedata.js has the towns' and routes' without the MapFileField
    fields (with _lite instead) until js/map-files.js fetches the file */
export interface MapData {
  name: string;
  /** width and depth, metres */
  w: number;
  h: number;
  /** the ground kind round the map */
  edge: TerrainKey;
  kind: 'town' | 'route' | 'room' | 'test';
  /** the location it belongs to (null on rooms, missing on test maps) */
  locationId?: DataId | null;
  hub: MapPoint;
  exits: MapPoint[];
  edgeExits?: EdgeExit[];
  /** the ground, a row of ground kinds per metre (h rows of w) */
  tiles: string[];
  /** the land's height at each metre corner ((h+1) rows of w+1) */
  heights?: number[][];
  /** the step grid (raised cells) and its material, base64 */
  steps?: string;
  stepm?: string;
  props: MapProp[];
  chat?: string[];
  test?: boolean | number;
  room?: string;
  building?: string;
  keeper?: string | null;
  indoor?: number;
  /** the walking camera (island track: orbit) */
  cam?: MapCam;
  /** island track: the island's middle and coastline */
  island?: IslandShape;
  /** island track: areas of the island */
  zones?: MapZone[];
  /** island track: building plots (IS-2) */
  plots?: MapPlot[];
  /** island track: the island generator's version, seed and dials */
  islandGen?: IslandGen;
  /** the kind of the map's water (walk/water-data.js WATER_KIND_LOOKS) */
  waterKind?: WaterKind;
  /** on a lite map (gamedata.js): the ground kinds and props it uses, so its look can start before its file comes */
  _lite?: { tiles: string; props: { k: string; v?: number; roof?: string }[] };
  /** the rest: the look (sky, haze, cam, moods), life, water, rails... read by the walk view and the renderer */
  [key: string]: any;
}

/** a map's walking camera: tilt (degrees), height (m), field of view */
export interface MapCam {
  pitch?: number;
  h?: number;
  fov?: number;
  orbit?: CamOrbit;
}

/** island track (docs/phases/island-track.md, "The contract"; logic/island.js checks it): the camera sits out over
    the sea and looks in at c */
export interface CamOrbit {
  /** the pivot, the island's middle */
  c: MapPoint;
  /** metres from c inside which the yaw holds its last value (the mountain top) */
  dead: number;
  /** seconds the yaw takes to follow */
  lag: number;
  /** degrees the player may still turn the camera on top of the orbit */
  turn: number;
}

/** island track: the island's middle and its coastline, a closed polygon (the last point joins the first) */
export interface IslandShape {
  c: MapPoint;
  coast: MapPoint[];
}

export type MapZoneKind = 'town' | 'barn' | 'pasture' | 'forest' | 'mountain' | 'cove' | 'beach' | 'path' | 'hamlet';

export type MapPlotKind = 'house' | 'home' | 'lab' | 'mast' | 'shop' | 'well' | 'farmhouse';

/** island track: a building plot the island generator laid out (IS-2): where a building of kind k may stand */
export interface MapPlot {
  k: MapPlotKind;
  /** its middle */
  x: number;
  z: number;
  /** its width along its street and its depth (m) */
  w: number;
  d: number;
  /** the angle its front faces (degrees, 0 east, 90 north) */
  a: number;
  /** the level its pad was made at */
  y?: number;
}

/** island track: an area of the island; a locked zone's ground and props are never touched when it is made again */
export interface MapZone {
  k: MapZoneKind;
  poly: MapPoint[];
  lock?: boolean;
}

/** island track: what the island generator (IS-2) needs to make the ground again (IS-2 owns the dials), and the lock */
export interface IslandGen {
  v: number;
  seed: string;
  dials?: Record<string, unknown>;
  /** the ground is frozen (the hub, once it is right): a change to it fails the data check; props stay free */
  lock?: boolean;
  /** the frozen ground's fingerprint (logic/island.js islandGroundHash) */
  hash?: string;
}

export type WaterKind = 'pond' | 'stream' | 'canal' | 'spring' | 'swamp' | 'lake' | 'sea' | 'lava' | 'ice';

/** the fields a lite map lacks (js/map-files.js MAP_FIELDS, tools/build-data.mjs) */
export type MapFileField = 'heights' | 'steps' | 'stepm' | 'tiles' | 'props';

/** an exit on a map's edge, where a road leaves */
export interface EdgeExit {
  id?: string;
  side: 'N' | 'S' | 'E' | 'W';
  /** where along the side, 0-1 */
  t: number;
  in?: number;
  width?: number;
  len?: number;
  path?: MapPoint[];
}

/** a prop placed on a map */
export interface MapProp {
  /** its kind, a key of gameData.scenery.props */
  k: string;
  x: number;
  z: number;
  /** scale */
  s?: number;
  /** flipped */
  f?: number | boolean;
  rot?: number;
  /** HB-6: a model's lean in degrees: toward its own +x, toward its back (+z) (logic/prop-turn.js tiltSpin) */
  tilt?: [number, number];
  /** hub placing: the height its base stands at (metres), not the ground's: the sky rail out over the sea, level with
   * its station (walk/frame-items.js propBaseHeight) */
  y?: number;
  /** variant */
  v?: number;
  act?: string;
  say?: string;
  label?: string;
  /** this one's model recipe instead of its kind's */
  model?: string;
  [key: string]: any;
}

/* ---------- encounters, money, items ---------- */

/** pools.json (and fishing.json): a level range and weighted species */
export interface Pool {
  lv: [min: number, max: number];
  list: WeightedSpecies[];
}

/** pyramids.json: a coin you tax Billies with */
export interface Coin {
  n: string;
  /** the tax odds multiplier (0: never fails) */
  m: number;
  price: number;
  d: string;
  /** badges needed before a shop sells it */
  need?: number;
}

/** items.json */
export interface Item {
  n: string;
  price: number;
  d: string;
  icon: string;
  hp?: number;
  hpAll?: number;
  cure?: string;
  revive?: number;
  evoItem?: number;
  /** RL-12b: levels a Billie gains when it eats one (the Protein Bar), used from its sheet, never in battle */
  lvlUp?: number;
  mint?: boolean;
  /** phase 17: fixes a robot's parts (1 = all of their HP) */
  repair?: number;
  /** RL-12c: a held item: what it does for the Billie holding it (logic/effects.js fxOfBillie); given from its sheet,
      never used up, never used in battle */
  hold?: FxRow[];
}

/** a shop: a run town's or stall's (logic/run-scenes.js), in SHOPS while the run's world is in */
export interface Shop {
  name: string;
  keeper: string;
  /** the keeper's look, a key of gameData.people */
  who: DataId;
  greeting: string;
  stock?: { item?: DataId; coin?: DataId; price: number }[];
  /** 'wardrobe' for a clothes shop */
  kind?: string;
  /** RS-4: a resident's hub shop: whose (residents.json), and the currency it takes (not Moneys) */
  res?: DataId;
  currency?: Exclude<CurrencyId, 'money'>;
  sells?: string[];
  thanks?: string[];
}

/* ---------- people and trainers ---------- */

/** people/<id>.json (person.schema.json): how a person looks (the old colour keys beside it are ignored) */
export interface Person {
  look: PersonLook;
  /** a creature person (Kappi): drawn from this rig instead of the look, ht metres tall */
  creature?: { rig: string; ht?: number };
  style?: string;
  hair?: Color;
  hat?: Color;
  hat2?: Color;
  top?: Color;
  top2?: Color;
  bottom?: Color;
  shoe?: Color;
  pack?: Color;
  skin?: Color;
  tie?: Color;
  [key: string]: any;
}

export interface PersonLook {
  name: string;
  body: Record<string, number>;
  skin: Color;
  hair: Color;
  eyes: Color;
  wear: Record<string, string | null>;
  colors: Record<string, any>;
}

/** trainers/<id>.json (trainer.schema.json): a trainer you can battle */
export interface Trainer {
  name: string;
  /** their look, a key of gameData.people ('chosen' when unknown) */
  who: DataId;
  /** their battle stage, a key of gameData.battleStages */
  battleStage?: DataId;
  /** the location where they wait (none for a tutorial trainer or a mini-boss) */
  node?: LocationNode;
  /** they block the road until beaten */
  blocks?: boolean;
  team: TrainerBilly[];
  reward: number;
  market?: { k: string; n: number } | null;
  marketText?: string;
  win: string;
  lose: string;
  hint?: string;
  blockTitle?: string;
  blockText?: string;
  /** a gym badge */
  seat?: Seat | null;
  /** what they say before a battle (docs/SCRIPTS.md); it ends with the battle */
  script?: string[];
  /** they run up to you the first time you come where they wait */
  runsUp?: boolean;
  /** Project Story S2: there only while this condition holds / unless it holds */
  when?: string;
  unless?: string;
  double?: boolean;
  /** only there once you've beaten this trainer */
  after?: DataId;
  /** only battles in a story scene; waits on no location */
  tutorial?: boolean;
  /** RL-5: a mini-boss (a badge leader): waits on no location; the runs' mini-boss pool (RL-13) */
  miniboss?: boolean;
  clue?: string;
  ending?: number;
  v47region?: number;
}

/** what game-data.js adds to each trainer at load */
export interface TrainerEntry extends Trainer {
  /** its key in gameData.trainers */
  id: DataId;
  /** RL-8: a run's foe (logic/run-loop.js runFoes): its map node, 'miniboss' or 'boss', the leader it copies, and
      for the boss its top Billie fought alone as an Alpha */
  runNode?: number;
  runFoe?: 'miniboss' | 'boss' | 'rival';
  from?: DataId;
  alpha?: boolean;
  /** RL-13: a run boss's HP times this (the Expedition's, logic/run-loop.js runFoes) */
  hpMult?: number;
  /** RL-14b: a bosses.json boss's id (the Voltron): the run's boss is that robot, not the team's Billie */
  boss?: string;
  /** RT-2: a route pair's second trainer (logic/route-trainers.js runRouteTrainers): its class, look and name */
  mate?: { cls: DataId; who: DataId; name: string };
}

/** a trainer's Billie: a species, or '@rival' ('@rival1', '@rival2': evolved) for the starter that beats yours */
export interface TrainerBilly {
  sp: SpeciesId;
  lvl: number;
  moves?: MoveId[];
  /** phase 17: with sp 'robot', its gem and parts (keys of robots.json) */
  robot?: { gem: DataId; torso: DataId; armL: DataId; armR: DataId; legs: DataId };
}

/** a gym badge */
export interface Seat {
  id: string;
  title: string;
  coin: DataId;
  pyramids: Record<DataId, number>;
  items: Record<DataId, number>;
  rewardText: string;
  unlockText: string;
}

/* ---------- rules ---------- */

/** rules.json: the numbers the game plays by */
export interface Rules {
  /** 'walk': you walk the roads yourself */
  start: {
    /** money */
    se: number;
    pyramids: Record<DataId, number>;
    items: Record<DataId, number>;
    /** the starters' line ids */
    starters: DataId[];
    starterLevel: number;
    starterEncounters: number;
    /** your starter's line -> the rival's species */
    rival: Record<DataId, SpeciesId>;
    /** where a new game starts */
    locationId: DataId;
  };
  /** phase 08: wild Billies on each place's map (rules.js encountersHere) */
  encounters: {
    /** how many a route keeps */
    route: number;
    /** how many a town with tall grass keeps (other towns: none) */
    townGrass: number;
    /** play time for one more to wander over */
    refillMs: number;
    /** prize money for beating a wild Billie, per level */
    prizePerLevel: number;
    /** a wild one is an Alpha once in this many (with two Billies on your team) */
    alphaOdds: number;
  };
  progression: {
    xpFactor: number;
    maxLevel: number;
    teamSize: number;
    moveSlots: number;
    /** XP yield by stage */
    xpYield: number[];
    trainerXpMult: number;
    teamXpShare: number;
  };
  battle: {
    stab: number;
    critChances: number[];
    critMult: number;
    rollMin: number;
    wildMindRollMin: number;
    wildMindRollMax: number;
    liveWireCrit: number;
    kindlingBoost: number;
    kindlingTurns: number;
    alloyBoost: number;
    /** RF-3 Undertow (Water): its Water moves hit this much harder at or below this share of its HP */
    undertowMult: number;
    undertowHp: number;
    oilShockMult: number;
    drainFraction: number;
    stonesFraction: number;
    paralysisSkip: number;
    hypeTurns: number;
    hypeSelfHit: number;
    subpoenaMin: number;
    subpoenaMax: number;
    stageMax: number;
    aiSmart: number;
    loseFee: number;
    /** roguelite track RL-4: a battle still going after this many turns ends as a draw ('draw': a wild battle as if
     * you walked away, a trainer's or a ghost's as a loss) */
    turnCap: number;
    shockType: TypeId;
    shockTurns: number;
    shockName: string;
    spinType: TypeId;
    spinTurns: number;
    /** RO-3f: how long Fork's copied types last */
    forkTurns: number;
    mailTurns: number;
    holdCap: number;
    alphaHp: number;
    alphaStats: number;
    alphaLevels: number;
    alphaActs: number;
    alphaTeam: number;
    alphaXp: number;
    alphaKeep: number;
    alphaSleepResist: number;
    /** optional (the code falls back to 0.5): an alpha's damage taken while its shield is up */
    alphaShieldMult?: number;
    /** optional (0.5): the share of its HP at which an alpha starts its second phase */
    alphaPhaseAt?: number;
    /** optional (2): how many turns an alpha's shield lasts */
    alphaShieldTurns?: number;
    spreadMult: number;
  };
  catching: {
    /** a first stage's catch rate by rarity */
    rarity: Record<string, number>;
    /** evolved stages' catch rates */
    evolved: number[];
    hpFactor: number;
    asleepCatch: number;
    status: number;
    spin: number;
    ring: number;
    edge: number;
    /** the lines that shrug off a plain Pyramid (its odds times luxuryPyramid) */
    luxury: DataId[];
    luxuryPyramid: number;
    alpha: number;
  };
  /** WA-6b: minHeight (m) is optional, none by default: any Billie of the types carries you */
  ride: { minHeight?: number; types: TypeId[] };
  fishing: { biteMin: number; biteMax: number; reactTime: number; reelTime: number };
  /** the legendary encounters, one per map (scene is a map id) */
  legends: { sp: SpeciesId; scene: DataId; lvl: number; title: string; text: string; line: string }[];
  /** phase 16: part sizes, weight and Prime (rules.js) */
  parts: PartRules;
  /** phase 17: robots (logic/fighters.js); missing in older data */
  robots?: RobotRules;
  /** roguelite track RL-3: runs. payout: what a run pays when it ends (logic/run-state.js payoutOf). The numbers are
      placeholders until the owner has played the first cut (roguelite-track.md 8.18) */
  run: {
    payout: {
      /** Research per Money left */
      money: number;
      /** items count at this share of their price, then at the money rate */
      itemShare: number;
      /** Research per Billie released in the run */
      released: number;
      /** Research per node cleared (each node once, however often it was walked back to; RL-6) */
      node: number;
      /** Research for a win */
      win: number;
      /** Crests for a win */
      winCrests: number;
      /** RL-9: Scrap per node cleared, and for a win */
      scrapNode: number;
      scrapWin: number;
      /** RL-S2: Beans for a win */
      beansWin: number;
    };
    /** RL-S2: Beans found on a run: the first badge of a type, a side area's leader beaten */
    beans: { badge: number; side: number; rival: number };
    /** RL-6: the run's node map (logic/run-map.js) */
    map: RunMapRules;
    /** RL-6: the clock (owner, 8.10): the forecast keeps `ahead` days after today (RL-R2: no deadline) */
    clock: { ahead: number };
    /** RL-6: what the map shows from where you stand: the rows up to `icons` ahead with their type, up to `unknown`
        ahead as '?' pins (the boss always) */
    reveal: { icons: number; unknown: number };
    /** RL-7: how a run node's scene varies (logic/run-scenes.js): mapgen's dials (MAPGEN_DEFAULTS' groups), each
        number a [low, high] range drawn from the node's stream, each choice (water, road shape and surface, feature)
        a record of weights. Dials left out keep mapgen's defaults */
    scene: RunSceneRules;
    /** RT-1: the layout plans a laid-out place is drawn from (logic/mapgen.js MAPGEN_LAYOUTS), weights by biome,
        `default` for a biome not listed (nodeTypes.json layout says which places are laid out) */
    layouts?: Record<string, Record<string, number>>;
    /** RL-7: a run node's wild Billies: levels `lv` on the landing's row, `perRow` more on each row after; a node
        walked back to rolls `back` of them again (the hub's stock on a first visit); a waystation (an event or a
        stall: RL-12b) holds `waystation`; RT-2: a run route's first visit holds `route` less its trainers, `routeMin`
        at least; RT-4: `habitats`, the types whose Billies wait by the water and in the woods (the rest: tall grass) */
    wild: {
      lv: [number, number];
      perRow: number;
      back: number;
      waystation: number;
      route: number;
      routeMin: number;
      habitats?: Record<string, string[]>;
      /** RT-4: a run route's rarer one, `up` levels above the rest (rules.js spawnRare) */
      /** RO-3f: myth: the chance a run route's rarer one is a mythical instead (at most one a run), and which */
      rare?: { up: number; myth?: { chance: number; list: DataId[] } };
    };
    /** RT-4b: a run route's finds (logic/route-finds.js): `perRoute` [fewest, most] a place on its free dead ends and
        pockets, `rare` the share drawn from `rareCards` (rewards.json cards; the rest a small item or candy card by
        weight), `brambles` the most Cut bramble rows a place */
    finds?: { perRoute: [number, number]; rare: number; rareCards: DataId[]; brambles: number };
    /** RL-7: metres past a seam before a crossing counts in a run (the hub's is 1), so a step over and back costs
        no day */
    seamIn: number;
    /** HB-2: the run's loading screen (logic/run-load.js): it lifts at capMs even when a stage is still waiting (the
        owner: 20 s) */
    load: { capMs: number };
    /** RL-8: what a run starts with, besides the Billies from home and the packed bag: its money, pyramids and items (placeholders) */
    start: { se: number; pyramids: Record<string, number>; items: Record<string, number> };
    /** RL-9b: by Expedition (index 0 = Expedition I; past the end, the last): how many items and pyramids (in all) are
        packed from Copperleaf's bag at the mast (placeholders) */
    pack: number[];
    /** RL-13: starter points: what a Billie at the ranch costs to take on a run, and the budget by Expedition
        (placeholders for the sim; logic/starter-points.js) */
    points: StarterPointRules;
    /** RL-8: a run town's clinic: $ per hurt Billie (free in the hub) */
    healCost: number;
    /** RL-8: a run town's shop: `always` on sale, then `more` wares a day drawn by weight from `pick` (an item id, or
        `coin:<id>`), at their own prices; drawn from the town's seed and the day */
    shop: { always: string[]; more: number; pick: Record<string, number> };
    /** RL-8: a mini-boss's and the boss's levels: `up` over the top wild level of their row; their reward in $ */
    foes: { miniboss: { up: number; reward: number }; boss: { up: number; reward: number } };
    /** RL-S2: Blake, the rival (logic/run-map.js runMapRival, logic/rival.js; placeholders) */
    rival: RivalRules;
    /** ON-2: a friend's ghost team (logic/run-map.js runMapGhost, logic/run-record.js ghostTeam) */
    ghost: GhostRules;
    /** ON-2: the daily and weekly runs (logic/daily.js boardPlan) */
    boards: BoardRules;
    /** RL-12b: route trainers: how many a route place by row ([fewest, most] from the first route row, the last for
     * every row after; RT-2), the share that stands by the road (`required`), the chance a place has a pair fought as
     * a double, levels over the place's top wild level, what each pays, how far they see (m) */
    trainers: {
      perRoute: [number, number][];
      required: number;
      pair: number;
      up: number;
      reward: number;
      sight: number;
    };
    /** RL-12b: the reward pick after a trainer battle: cards, a reroll's first price, how it grows each time */
    rewards: { pick: number; reroll: number; grow: number };
    /** RL-12: Perks: at most `cap` held, a pick of `pick` after a mini-boss, offered by `rarity` weight, sold in a
        run shop at `price` by rarity (placeholders) */
    perks: {
      cap: number;
      pick: number;
      rarity: Record<PerkRarity, number>;
      price: Record<PerkRarity, number>;
    };
    /** RL-R2: side areas (logic/run-side.js) */
    side?: RunSideRules;
    /** TW-2: a run town's life: how many folk are drawn at most (busy: the game stepped its quality down; balanced
        and best: the Graphics presets), how many named locals (fewest, most) and their names, and each region
        theme's chat lines (added to the biome's) */
    town: RunTownRules;
  };
  /** roguelite track RL-9: the ranch (logic/ranch.js). Placeholders until the owner has played it */
  ranch: RanchRules;
  /** hub track HB-10c: the town square's day (logic/square-day.js) */
  square: SquareRules;
}

/** rules.json square: when the square's folk stop where, and the ranch's Billies' visits (logic/square-day.js) */
export interface SquareRules {
  /** the slots of the day (hours 0-24, in order, none overlapping): a share of the town's folk go to stops of these
   * kinds (keep, shop, sit, lamp, fountain), taken in turn */
  day: { k: string; from: number; to: number; share: number; stops: string[] }[];
  /** the ranch's Billies walking over from the pasture: at most `most` in a block of `every` seconds, leaving between
   * the hours from and to, walking `walk` m/s, staying `stay` seconds (fewest, most) at stops of these kinds */
  visit: {
    most: number;
    from: number;
    to: number;
    every: number;
    walk: number;
    stay: [number, number];
    stops: string[];
  };
  /** HB-10d: the busker's slot: within `near` metres of a busker you hear your last run's theme (region theme -> song) */
  busk: { near: number; songs: Record<string, string> };
  /** HB-10d: the fountain's coin (logic/fountain-wish.js): what a toss costs, and its outcomes by weight, each lines
   * to show and what it does (effect rows for the next run's first `places`, items into the bag, a payout at once) */
  wish: {
    cost: { cur: string; n: number };
    outcomes: {
      id: string;
      w: number;
      say: string[];
      fx?: FxRow[];
      places?: number;
      give?: Record<string, number>;
      pay?: Record<string, number>;
    }[];
  };
}

/** RL-13: rules.json run.points: a Billie's cost in starter points and the budget a run has (logic/starter-points.js) */
export interface StarterPointRules {
  /** the points to spend, by Expedition (index 0 = Expedition I; past the end, the last) */
  budget: number[];
  /** the base cost by the line's rarity */
  rarity: Record<string, number>;
  /** more per evolution stage above the first */
  stage: number;
  /** the most the base cost (rarity and stage) can come to */
  most: number;
  /** levels above this cost extra */
  levelsFrom: number;
  /** one point more per this many levels above levelsFrom */
  perLevels: number;
  /** SP-4: one point more per this much Stability a Billie's splice spends (none when left out) */
  perStability?: number;
  /** the most Billies a run can start with */
  team: number;
}

/** rules.json ranch: training between runs (logic/ranch.js) */
export interface RanchRules {
  /** training slots by ranch level (index 0 = level 1; past the end, the last) */
  slots: number[];
  /** the highest level a Billie trains to: capBase at ranch level 1, capStep more each level */
  capBase: number;
  capStep: number;
  /** a trainee banks at most this many hours between collections */
  bankHours: number;
  /** levels gained an hour of training (each level its own share of XP) */
  levelsPerHour: number;
  /** Scrap to start training one Billie */
  trainCost: number;
  /** a clock this far behind a trainee's start (ms) is allowed; further back, nothing is gained and it starts again */
  guardMs: number;
  /** IS-8: at most this many of the ranch's Billies wander in the hub's pasture (logic/pasture.js) */
  pasture: number;
  /** RL-10: breeding at the ranch (logic/breeding.js) */
  breed: BreedRules;
  /** RL-10b: the ranch's passive income (logic/ranch-income.js) */
  income: IncomeRules;
}

/** rules.json ranch.income: Scrap the ranch earns by itself on real time, up to a cap (RL-10b) */
export interface IncomeRules {
  /** Scrap an hour by ranch level (index 0 = level 1; past the end, the last) */
  rate: number[];
  /** the most hours the ranch banks between collections */
  capHours: number;
}

/** rules.json ranch.breed: two Billies from home make an egg that hatches at the ranch (RL-10) */
export interface BreedRules {
  /** eggs the nursery holds at once, by ranch level (index 0 = level 1; past the end, the last) */
  nests: number[];
  /** Scrap for a safe pair (two of one line) and a risky one (any two; costs less) */
  safeCost: number;
  riskyCost: number;
  /** real hours from the pair's start to the egg hatching */
  hours: number;
  /** the level a Billie hatches at */
  lvl: number;
  /** a risky egg's odds: like a safe one, a quirk, an abomination (they add up to 1) */
  odds: { safe: number; quirk: number; abom: number };
  /** an abomination's stat spike and drawback: one stat times abomUp, another times abomDown */
  abomUp: number;
  abomDown: number;
}

/** rules.json run.scene: mapgen's dials as ranges and weights (RL-7) */
export type RunSceneRules = {
  [group: string]: [number, number] | Record<string, number> | RunSceneRules;
};

/** rules.json run.map: how a run's node map is laid out (logic/run-map.js runMapMake; placeholders, 8.18) */
export interface RunMapRules {
  /** rows (steps) from the landing (0) to the boss (the last): the places on every path. WM-2: the run's own, drawn
      from `path` (logic/run-map.js runMapLength) unless given (the debug menu's short map) */
  rows: number;
  /** mini-bosses, each on a row of its own with its town right after it (WM-2), the free rows shared out between
      them: the run's own, as many as fit `rows` within `towns`, unless given */
  minibosses: number;
  /** WM-2: the places a path by Expedition (index 0 = Expedition I; past the end, the last): [fewest, most] */
  path?: [number, number][];
  /** WM-2: the fewest and most towns (each after a mini-boss) a run */
  towns?: [number, number];
  /** the nodeTypes.json types of the landing, the row before each mini-boss, the mini-bosses and the boss */
  first: DataId;
  rest: DataId;
  guard: DataId;
  last: DataId;
  /** the chance a free or town row has two lanes, and that two lanes side by side get a switch (one diagonal) */
  wide: number;
  cross: number;
  /** the biomes nodes pick from, by weight (biomes.json ids) */
  biomes: Record<DataId, number>;
  /** RL-R1: the region's zones in order (logic/run-region.js): their rows add up to rows, each row takes its zone's
   * biome (then biomes is not drawn) */
  zones?: { biome: DataId; rows: number }[];
}

/** rules.json robots: the numbers behind robot stats, part HP and breaking (logic/fighters.js) */
export interface RobotRules {
  _help?: string;
  /** the four part slots a robot has, in order */
  slots: RobotSlot[];
  /** added to every stat before the parts */
  baseStat: number;
  /** a part's HP as a share of the robot's max HP (times the part's dur) */
  partHpRatio: number;
  /** a share of a hit's damage a limb loses */
  partShare: number;
  /** how likely a hit lands on each slot (the torso: the body only) */
  hitWeights: Record<RobotSlot, number>;
  /** Speed x this with broken legs */
  legBreakSpeed: number;
  /** each upgrade level adds this share to a part's stats */
  upgradeStat: number;
  maxUpgrade: number;
  /** over the legs' carry: Speed x (carry / weight) ^ this */
  overweightExp: number;
  /** under the carry: up to this much faster */
  lightBonus: number;
  /** Attack and Sp. Atk x (weight / refWeight) ^ attackExp, capped at +-cap */
  refWeight: number;
  attackExp: number;
  cap: number;
  /** a move of the gem's type hits this many times as hard */
  gemAffinity: number;
  /** the XP for beating one, like a species' yield */
  xpYield: number;
}
export type RobotSlot = 'torso' | 'armL' | 'armR' | 'legs';

/** robots.json (phase 17): robot parts and gems */
/** kitBuilds.json (Studio plan Phase 5, T5.1): every kit Billie's recipe and the baker's settings */
export interface KitBuilds {
  note?: string;
  bake: KitBake;
  /** named colours: hue 0-1, saturation scale, value scale */
  colours: Record<string, [number, number, number]>;
  forms: KitBuildForm[];
}
/** the baker's settings (were the retired Python builder's constants) */
export interface KitBake {
  /** the stage box every Billie fits in, its middle and ground line */
  box: { w: number; h: number; cx: number; base: number };
  /** keep this many pixels clear of the box's edges */
  margin: number;
  /** room round a torso for its squash and stretch frames */
  pad: number;
  /** each torso frame's [x scale, y scale] */
  squash: Record<string, [number, number]>;
  sheetW: number;
  /** where a tail part points from the front (degrees, 0 = out to the right, 90 = up) */
  tailAim: Record<DataId, number>;
  /** from behind a tail sweeps this much of its aim */
  tailBackSweep: number;
  /** how far out an arm's far end hangs (degrees) */
  armOut: number;
  /** how far apart the feet stand, as their width */
  footGap: number;
  /** the chin sits this much of the head's height below the neck */
  chinDrop: number;
  /** the extras' anchors: the top left from the head or torso (x[0], y[0], fractions of it) plus fractions of the
   * extra (x[1], y[1]), the draw order front and back, the bone's name */
  anchors: Record<
    string,
    { on: 'head' | 'torso'; x: [number, number]; y: [number, number]; z: number; zb: number; name: string }
  >;
}
/** one kit Billie: [part id, size, colour (a name in colours, [h, s, v] or null)] per bone kind, and its extras
 * [part id, anchor, size, colour, mirrored pair, slot?] */
export interface KitBuildForm {
  name: string;
  rig: string;
  line: DataId;
  stage: number;
  scale: number;
  parts: Record<string, [DataId, number, string | number[] | null]>;
  extras?: [DataId, string, number, string | number[] | null, boolean, string?][];
  /** the slot a bone kind fills, in place of its usual one */
  slots?: Record<string, string>;
  /** how far out the arms hang (degrees), in place of bake.armOut */
  armOut?: number;
}
/** partKits.json (studio track ST-3): parts cut from kit sheets; x and y are fractions of the picture, y down */
export interface PartKits {
  note?: string;
  _help?: string;
  /** how each kit's sheets are sliced (the workbench's settings, kept so the same sheet slices the same way) */
  kits?: Record<string, Record<string, unknown>>;
  /** the slot each kind fills */
  slots?: Record<string, PartSlot>;
  /** each kind's turning point */
  pivots?: Record<string, [number, number]>;
  /** sockets given by hand, per part and view; they replace the ones worked out from the outline */
  sockets?: Record<DataId, { front?: Record<string, [number, number]>; back?: Record<string, [number, number]> }>;
  /** each kind's draw order per view (studio track ST-4) */
  z?: Record<string, PartZ>;
  /** each kind's turn limits, [least, most] degrees */
  turns?: Record<string, [number, number]>;
  /** the side each kind's art is drawn for (L: the socket on the viewer's left); mirrored on the other side */
  sides?: Record<string, 'L' | 'R'>;
  /** socket name: the slots that may attach there */
  socketRules?: Record<string, PartSlot[]>;
  parts: Record<DataId, KitPart>;
}
/** draw order per view: higher is drawn in front */
export interface PartZ {
  front?: number;
  back?: number;
}
export type PartSlot = 'head' | 'headExtra' | 'body' | 'bodyExtra' | 'front' | 'back' | 'sig';
export interface KitPart {
  kit: string;
  /** the animal it comes from, or 'any' (a kit's extras) */
  animal: string;
  kind: string;
  slot: PartSlot;
  pivot: [number, number];
  size: 'S' | 'M' | 'L';
  views: { front?: KitPartView; back?: KitPartView };
  /** its own draw order, in place of its kind's */
  z?: PartZ;
  /** its own turn limits, in place of its kind's */
  turn?: [number, number];
  /** its own socket rules, in place of socketRules for these sockets */
  accepts?: Record<string, PartSlot[]>;
  /** the part this is the other side of (Mirror to other side) */
  mirrorOf?: DataId;
}
export interface KitPartView {
  /** the picture, under game/art */
  file: string;
  w: number;
  h: number;
  sockets?: Record<string, [number, number]>;
  /** this view's turning point; the part's pivot when not given */
  pivot?: [number, number];
  /** hand-painted S and L pictures; a size not here is M scaled about the pivot */
  sizes?: { S?: KitPartSize; L?: KitPartSize };
}
export interface KitPartSize {
  /** next/parts/<view>/<id>_s.png or _l.png */
  file: string;
  w: number;
  h: number;
  pivot?: [number, number];
  sockets?: Record<string, [number, number]>;
}

/** coats.json: a recolour of a Billie's art (game/js/logic/coats.js) */
export interface Coat {
  /** shown to the player */
  name: string;
  /** whole palette ramps swapped step for step: { ember: 'indigo' } */
  ramps?: Record<string, string>;
  /** exact colours swapped after the ramps: { '#d94c21': '#3f3980' } */
  swap?: Record<Color, Color>;
  /** found once in this many; none means never */
  odds?: { wild?: number; egg?: number; fish?: number };
  /** hand-painted sheets per species and view, in place of the recolour (paths under game/art) */
  art?: Record<SpeciesId, { front?: string; back?: string }>;
  /** RO-1: a regional form's look: never rolled, no word before the name (the form's name says it) */
  form?: boolean;
}

export interface RobotData {
  _help?: string;
  parts: Record<DataId, RobotPart>;
  gems: Record<DataId, RobotGem>;
}
export interface RobotPart {
  name: string;
  /** a torso's family name */
  short?: string;
  /** which slot it fits: an arm fits either side */
  slot: 'torso' | 'arm' | 'legs';
  type: TypeId;
  rar?: string;
  /** kg */
  wt: number;
  /** its own HP x this (default 1) */
  dur?: number;
  /** legs: kg they carry before the robot slows down */
  carry?: number;
  /** the move it gives (arms and legs) */
  move?: MoveId;
  stats: Partial<Record<StatId, number>>;
  /** the placeholder picture */
  art: {
    color: Color;
    shape: string;
    w?: number;
    h?: number;
    img?: string;
    imgB?: string;
    head?: string;
    headB?: string;
    /** studio track ST-5: where its picture joins, per view; the rest is worked out from the picture's size */
    joints?: RobotJoints;
    /** a torso's head: where its picture joins the neck */
    headJoints?: RobotJoints;
    /** how far it may turn, [least, most] degrees (the workbench's test fit) */
    turn?: [number, number];
    headTurn?: [number, number];
  };
  d?: string;
}
export interface RobotJoints {
  front?: RobotJoint;
  back?: RobotJoint;
}
/** points are fractions of the picture, x right and y down */
export interface RobotJoint {
  /** the point it hangs from and turns around */
  pivot?: [number, number];
  /** a torso's sockets: neck, shoulderL, shoulderR, hipL, hipR, hip, gem */
  sockets?: Partial<Record<RobotSocket, [number, number]>>;
  /** draw order in this view: higher is drawn in front */
  z?: number;
}
export type RobotSocket = 'neck' | 'shoulderL' | 'shoulderR' | 'hipL' | 'hipR' | 'hip' | 'gem';
export interface RobotGem {
  name: string;
  short?: string;
  type: TypeId;
  rar?: string;
  /** its signature move */
  move: MoveId;
  stats: Partial<Record<StatId, number>>;
  color: Color;
  /** its picture on the torso's chest, a path in game/art */
  img?: string;
  d?: string;
}

/** rules.json parts: the slots, how likely each size is, how big it is drawn and how heavy it is */
export interface PartRules {
  slots: string[];
  /** each slot's share of the species' weight (they add up to 1) */
  share: Record<string, number>;
  sizes: Record<string, { odds: number; scale: number; weight: number }>;
  attackExp: number;
  speedExp: number;
  /** the most a stat moves either way from weight (0.2 = 20%) */
  cap: number;
  /** a Prime Billie's bonus on every stat */
  primeBonus: number;
}

/* ---------- looks: battle stages, scenery, moods, engine, wardrobe ---------- */

/** battleStages.json: a battle's backdrop */
export interface BattleStage {
  name: string;
  /** three sky colours, top to horizon */
  sky: Color[];
  fog: Color;
  fogD: number;
  amb: string;
  far?: string;
  indoor?: number;
  wall?: string;
  art?: string;
}

/** scenery.json: the ground kinds and the prop catalogue */
export interface Scenery {
  /** pixels per unit of the prop art */
  ppu: number;
  tile: number;
  terrains: Record<TerrainKey, Terrain>;
  props: Record<string, PropKind>;
  person: number;
  life: Record<string, any>;
  buildArt: Record<string, any>;
  wallArt: string;
  flags: string[];
  tileSet: string;
}

export interface Terrain {
  name: string;
  tile: string;
  z: number;
  edge: Color;
  vars: any[];
  paved?: boolean | number;
  [key: string]: any;
}

/** a kind of prop in the catalogue (gameData.scenery.props) */
export interface PropKind {
  name: string;
  img: string;
  ox: number;
  oy: number;
  shadow: number;
  sway: number;
  flat: number;
  tags: string[];
  group: string;
  /** its model recipe (art/scene/vox/<name>.json) */
  model?: string;
  solid?: number;
  box?: number[];
  /** HB-6: a model that spans its box's width (a fence rail): it rests on the ground under each end, tipped between
   * them (logic/prop-turn.js spanFit) */
  restEnds?: number;
  /** the rest: door, fx, build, layers, glow, vol... read by the renderers and the Studio */
  [key: string]: any;
}

/** moods.json: a colour grade */
export interface Mood {
  name: string;
  sat: number;
  con: number;
  warm: number;
  lift?: number[];
  gain?: number[];
  sh?: number[];
  hi?: number[];
}

/** engine.json: the renderer's settings and presets (engine/settings.js has the keys) */
export interface Engine {
  defaults: Record<string, any>;
  presets: Record<string, any>;
}

/** wardrobe.json: the dressing room's body, slots and clothes (dressing-room.js, person-art.js) */
export interface Wardrobe {
  version: number;
  /** studio art track SA-3: the boutiques an item's `shop` names (moved here from the old Town shops) */
  shops?: Record<DataId, { name: string }>;
  [key: string]: any;
}

/* ---------- Project Story ---------- */

/** story.json: every story flag (saveData.story) and what it means, the names scripts write before a line, quests,
    and the start points for ?story=<preset> (test runs only) */
export interface StoryData {
  about?: string;
  flags: Record<string, string>;
  /** flags made from an id: 'met_<id>' */
  patterns: Record<string, string>;
  /** saveData.story's records that aren't flags (talks, quests, once, cycles, resume) */
  kept: Record<string, string>;
  /** a name a script writes before a line -> a person id, or 'me' */
  speakers: Record<string, DataId>;
  quests: Record<DataId, { about?: string; stages: string[] }>;
  /** scripts that belong to the story, not to someone: story:<id> */
  scripts?: Record<DataId, { about?: string; who: DataId; script: string[] }>;
  /** a chapter swaps maps for variant files while its condition holds */
  chapters?: Record<DataId, { about?: string; when: string; maps: Record<DataId, string> }>;
  presets: Record<string, StoryPreset>;
}
/** a cutscene: the map it is filmed on, its named spots, shots and lanes, what is cleared away while filming, its
    script (cutscene.schema.json). Points are the map's own coordinates in metres; a shot's heights are above the
    ground under each point */
export interface CutsceneData {
  about?: string;
  map: DataId;
  /** who says a line that names nobody (a speaker in story.json) */
  who?: string;
  /** its own time of day (0-24), weather and season while it plays, whatever Settings say */
  look?: { time?: number; weather?: string; season?: string };
  spots: Record<string, [x: number, z: number]>;
  shots: Record<string, CutsceneShot>;
  lanes?: Record<string, [x: number, h: number, z: number][]>;
  clear?: {
    areas?: [x0: number, z0: number, x1: number, z1: number][];
    paths?: [from: string, to: string][];
    pathWidth?: number;
    eyes?: [x: number, z: number][];
    eyeRadius?: number;
  };
  script: string[];
}
export interface CutsceneShot {
  eye: [x: number, h: number, z: number];
  tgt: [x: number, h: number, z: number];
  /** degrees, 40 if left out */
  fov?: number;
  /** metres round the target kept in frame on a narrow phone */
  w?: number;
}
export interface StoryPreset {
  about: string;
  /** a location id */
  place: DataId;
  flags?: Record<string, any>;
  /** trainer ids; a leader's badge comes with them */
  beaten?: DataId[];
  pyramids?: Record<DataId, number>;
  items?: Record<DataId, number>;
  team: { sp: string; lvl: number }[];
}

/* ---------- lore ---------- */

/** lore.json: the Guide's Lore pages; unlock says when an entry shows ('start', 'flag:<flag>', 'meet:<person>',
    'location:<location id>') */
export interface Lore {
  world: any[];
  story: any[];
  people: Record<DataId, { name: string; role: string; unlock: string; text: string; voice: string; who?: DataId }>;
  /** each location's history, keyed by its id */
  locations: Record<DataId, { history: string; known: string; landmark: string; legend: string }>;
  legends: { id: string; title: string; locationId: DataId; unlock: string; text: string }[];
  clues: { id: string; title: string; unlock: string; text: string; at?: any }[];
  books: Record<DataId, { title: string; by: string; pages: string[] }>;
  loading: string[];
  /** townsfolk chatter, keyed by map */
  chat: Record<DataId, any>;
}

/** portraits.json (phase 07): 64x64 talking heads. Pictures are art/next/portraits/<img>.png */
export interface PortraitData {
  _help?: string;
  /** art pixels a side */
  size: number;
  /** what a face can wear, in drawing order */
  slots: { id: DataId; name: string; one: boolean; layer?: 'body' | 'head' }[];
  heads: Record<DataId, PortraitHead>;
  items: Record<DataId, PortraitItem>;
  eyes: Record<DataId, { name: string; frames: Record<string, string>; mid: string[]; dx: number; dy: number }>;
  mouths: Record<DataId, { name: string; frames: Record<string, string>; dx: number; dy: number }>;
  /** an eye frame a style lacks -> the one it uses */
  eyeFallback: Record<string, string>;
  expressions: Record<string, PortraitExpression>;
  motion: {
    sway: number;
    talkSway: number;
    nod: number;
    nodChance: number;
    hits: number;
    hairLag: number;
    follow: number;
  };
  palettes: Record<'skin' | 'hair' | 'iris' | 'cloth', string[]> & Record<string, string[]>;
  faces: Record<DataId, PortraitFace>;
}
/** a head: its pictures and the points on it parts hang from (art px in the 64x64 frame) */
export interface PortraitHead {
  name: string;
  img: string;
  body: string;
  x: number;
  y: number;
  bodyY: number;
  cx: number;
  crown: number;
  forehead: number;
  eyeY: number;
  noseY: number;
  mouthY: number;
  /** the point the head turns around */
  neck: number;
  bottom: number;
  /** from the middle to each eye */
  eyeGap: number;
  earL: number;
  earR: number;
  earY: number;
  lobeY: number;
  /** which cut of the clothes fits */
  top: 's' | 'm' | 'l';
  /** item id -> [dx, dy] on this head only */
  nudge: Record<DataId, [number, number]>;
}
export interface PortraitItem {
  slot: DataId;
  name: string;
  /** one picture, a left/right pair, or one per clothes cut */
  img: string | { l: string; r: string } | { s: string; m: string; l: string };
  /** the head's point it hangs on; a pair uses <at>L and <at>R */
  at: string;
  /** which point of the picture sits there (0..1) */
  ax: number;
  ay: number;
  /** px; on a pair, outwards */
  dx: number;
  dy: number;
  tint?: 'skin' | 'hair' | 'iris' | 'top' | 'hat' | 'acc';
  layer?: 'body' | 'head';
  /** hair: the part behind the body */
  back?: { img: string; dx: number; dy: number };
}
export interface PortraitExpression {
  eyes: string;
  mouth: string;
  browTilt: number;
  browLift: number;
  blush?: boolean;
  talk?: string[];
  /** where the head settles: x, y (art px), angle (degrees) */
  pose: [number, number, number];
  sway: number;
  hit?: 'bounce' | 'shake' | 'jolt' | 'recoil' | 'nod';
}
/** a face: a head, eyes, a mouth, the parts it wears and its colours (no skin colour: the head's own) */
export interface PortraitFace {
  name: string;
  head: DataId;
  eyes: DataId;
  mouth: DataId;
  items: DataId[];
  colors: Partial<Record<'skin' | 'hair' | 'iris' | 'top' | 'hat' | 'acc', string>>;
}

/** worldmap.json: the world map's look (phase 10; the Studio's World map look tab edits it) */
export interface WorldMapLook {
  sea: {
    share: number;
    depth: number;
    rimLand: number;
    rough: number;
    seed: number;
    paint?: { land: boolean; r: number; pts: [number, number][] }[];
  };
  relief: { max: number; default: [number, number]; kinds: Record<string, [number, number]> };
  regions: Record<string, { ground: string; wet: string; dry: string; high: string; trees: string[] }>;
  kinds: Record<string, string>;
}

/** biomes.json: what the map generator (logic/mapgen.js) grows and paints for a biome */
export interface Biome {
  name: string;
  /** the kind of weather it gets (logic/weather.js CLIMATE_WEATHER_ODDS): a run node's forecast rolls from it (RL-6) */
  climate: string;
  /** RL-7: a run node's Billies (a pools.json pool: its species; the run sets the levels), battle stage
      (battleStages.json) and colour grade (moods.json) */
  pool: DataId;
  battleStage: DataId;
  mood: DataId;
  ground: {
    base: string;
    patches?: Record<string, number>;
    verge: string;
    floor: string;
    bank: string;
    rock: string;
    tall: string;
  };
  road: string;
  water: string;
  trees: Record<string, number>;
  shrubs?: Record<string, number>;
  plants?: Record<string, number>;
  rocks?: Record<string, number>;
  waterPlants?: Record<string, number>;
  /** RT-1: the canopy pieces filling a laid-out route's forest masses */
  canopy?: Record<string, number>;
  /** RT-1: the fence, wall or hedge of a laid-out route's runs */
  fences?: Record<string, number>;
  tall: Record<string, number>;
  look?: Record<string, unknown>;
  life?: { k: string; n: number }[];
  /** TW-1: a run town's buildings and dressing (logic/mapgen.js mapgenStageTown): house props by weight (shut: for
      show only), the square's centre, the plots' fence, the square's ground letter, the lamp and the bench */
  town?: {
    houses: Record<string, number>;
    centre: string;
    fence?: string;
    square?: string;
    lamp?: string;
    bench?: string;
    /** TW-2: its own animals, kept to the town's ground (houses: only with that many houses; square: on the square) */
    life?: { k: string; n: number; houses?: number; square?: 1 }[];
    /** TW-2: what its folk and named locals say (with the region's: rules.json run.town.chat) */
    chat?: string[];
  };
  from?: string;
}

/** nodeTypes.json: a kind of node on a run's map (roguelite track RL-6) */
export interface NodeType {
  /** what the player reads */
  name: string;
  /** RL-S2: the word its place's name ends with, when not the name (a rival's place is a Route) */
  place?: string;
  /** its marker's outline (logic/run-marks.js RUN_MARK_TYPES); the type's id when left out */
  mark?: string;
  /** how it plays: a walkable map, or a menu (a story script or a shop sheet, RL-12) */
  engine: 'scene' | 'menu';
  /** how often it fills a free row (rules.json run.map gives the other rows their types); 0 or none: never */
  weight?: number;
  /** RL-12b: it sells things (a town, a stall): the map never puts two of them one after the other */
  shop?: boolean;
  /** RT-1: its place is laid out as a route (a plan from rules.json run.layouts by biome) */
  layout?: boolean;
  /** RL-14: instead of a weight, the chance a free node becomes it (on its own stream), from map row fromRow on */
  chance?: number;
  fromRow?: number;
  /** WM-2: it counts as a route between towns (a route, the rival's, a mini-boss's, a scrapyard; not a waystation, a
      stall or the landing): the map puts one on every lane of the free row before each mini-boss */
  routeLike?: boolean;
  /** WM-3: the footprints its place may take on the region grid, by weight: 'WxH' cells (wide x tall) or 'L' (two by
      two, a corner walled off); left out: two by one (logic/run-map.js runShapeSize) */
  shapes?: Record<string, number>;
}

/** music.json: a song's recipe, composed into notes by the tracker (game/js/audio/tracker.js; sound track SND-2) */
export interface SongRecipe {
  bpm: number;
  /** the home note, as a midi note */
  key: number;
  scale: 'major' | 'minor' | 'dorian' | 'lydian' | 'mixo';
  /** each bar's chord, as a scale degree (0 is I) */
  prog: number[];
  lead: string;
  bass: 'bounce' | 'gallop' | 'long' | 'walk' | 'drive' | 'none';
  arp: 'up' | 'updown' | 'drip' | 'chord7' | 'none';
  drums: 'soft' | 'skip' | 'drive' | 'march' | 'bossa' | 'none';
  seed: number;
  swing?: number;
  echo?: number;
  seventh?: 0 | 1;
  /** SND-4: keep the thicker mix (sine arps, the night pad) instead of four voices: the title and the fall */
  extra?: boolean;
  /** SND-4: a music-box lead: short notes, no vibrato (Copperleaf) */
  pluck?: boolean;
  /** SND-4 and SND-5 (none yet): written lines of [step, midi, length], intro bars, night changes */
  hook?: [number, number, number][];
  counter?: [number, number, number][];
  intro?: number;
  /** SND-4: one name for the hook and counter; Claude's drafts start with "placeholder" */
  hookName?: string;
  /** SND-4: the night version's changes; false: none (audio/tracker.js trackerNight) */
  night?: Partial<SongRecipe> | false;
}

/** music.json: a rule of the where table; the first whose every key matches picks the song (logic/music-where.js) */
export interface MusicWhere {
  started?: boolean;
  battle?: string;
  tab?: string;
  indoor?: boolean;
  map?: string[];
  placeKind?: 'city' | 'town';
  nodeType?: string;
  biome?: string;
  row?: [number, number];
  /** a song, or $place: the place's own song */
  song: string;
}

/** music.json (sound track SND-2) */
export interface Music {
  songs: Record<DataId, SongRecipe>;
  /** [midi note, length in sixteenths]; note 0 rests */
  jingles: Record<
    DataId,
    { notes: [number, number][]; /** SND-4: Claude's drafts start with "placeholder" */ name?: string }
  >;
  cries: { bases: { wave: string }[] };
  where: MusicWhere[];
}

/** perks.json: how often a Perk is offered and what a shop asks for it (rules.json run.perks) */
export type PerkRarity = 'common' | 'uncommon' | 'rare';
/** perks.json: one effect row (logic/effects.js FX_KINDS; the schema says what each kind takes) */
export type FxRow =
  | { kind: 'money'; mult: number }
  | { kind: 'price'; what: 'shop' | 'heal'; mult: number }
  | { kind: 'catch'; mult: number }
  | { kind: 'stat'; stat: 'lev' | 'law' | 'lob' | 'pr' | 'hus'; stages: number }
  | { kind: 'damage'; side: 'deal' | 'take'; cat?: 'H' | 'S'; type?: string; mult: number }
  | { kind: 'heal'; share: number }
  | { kind: 'payout'; what: 'research' | 'itemShare'; mult: number }
  /** RL-13 (modifiers.json only): foes' levels up by n; the boss's HP times mult */
  | { kind: 'level'; n: number }
  | { kind: 'bossHp'; mult: number }
  /** RL-12c (held items only, for the holder): its XP times mult; a share of its HP at each turn's end; once a battle,
      a share of its HP at `at` of its HP or below */
  | { kind: 'xp'; mult: number }
  | { kind: 'turnHeal'; share: number }
  | { kind: 'pinchHeal'; at: number; share: number }
  /** SP-2 (genes.json unstable only): the Billie loses a share of its HP at each turn's end */
  | { kind: 'turnHurt'; share: number }
  /** SP-6: a Gene Sample's DNA, the wild splice odds, an Unstable splice's turn-end hurt (Perks), times mult */
  | { kind: 'dna'; mult: number }
  | { kind: 'splice'; mult: number }
  | { kind: 'unstable'; mult: number };
/** SP-2: genes.json: what spliced parts do (logic/genes.js). Every number is a placeholder until the owner sets it */
export interface Genes {
  about?: string;
  /** a part kind (partKits.json parts.kind) and the trait it brings */
  kinds: Record<string, { trait: string; word?: string; field?: string }>;
  traits: Record<string, GeneTrait>;
  /** per part id: its dominant type (the Billie's second type) and the move it teaches (SP-4) */
  parts: Record<string, { type?: string; move?: string; field?: string }>;
  /** the most traits a Billie has */
  maxTraits: number;
  /** SP-3: the share of a run place's wild Billies spliced at spawn (a Graft, a Chimera; escaped waits for SP-5's
   * Augments), a Chimera's fewest and most foreign parts, and the DNA a beaten one pays */
  wild: {
    graft: number;
    chimera: number;
    escaped: number;
    chimeraParts: [number, number];
    /** SP-5: escaped, an Escaped specimen's (the Graft's when missing) */
    dna: { graft: number; chimera: number; escaped?: number };
  };
  /** SP-4: the Gene Bank: per level its Stability limit and the slots it splices, a splice's DNA price (base + perCost x
   * the Gene's Stability cost), the chance an egg keeps each parent's spliced slot */
  bank: GeneBank;
  /** a foreign part's cost (same line, same kit, another kit, an Augment), the limit, how far past it is refused */
  stability: { line: number; kit: number; other: number; augment: number; limit: number; refuse: number };
  /** a splice past the limit: one stat times up, another times down, and the drawback */
  unstable: GeneTrait & { up: number; down: number };
  /** SP-5: Augments, robots.json arms and legs fitted on a Billie at the Workshop (logic/augments.js) */
  augment: GeneAugment;
}
/** SP-5: genes.json augment (every number a placeholder) */
export interface GeneAugment {
  about?: string;
  /** per slot the robot part it takes, the side an arm goes on, and that side's share of the slot */
  slots: Partial<Record<'front' | 'back', { part: 'arm' | 'legs'; side?: 'L' | 'R'; share: number }>>;
  /** the share of the part's stats (robots.json stats, upgrades included) added to the Billie's base stats */
  statShare: number;
  /** per robot part id, the field move (fieldMoves.json) it counts for */
  field: Record<string, string>;
  /** the part's move: extra (beside the learned ones while fitted) or none */
  move: 'extra' | 'none';
  /** the escaped odds' multiplier at a place one step from a scrapyard */
  escapedNear: number;
  /** what a knocked-out Escaped specimen leaves beside its DNA: its part, or nothing more */
  knockout: 'part' | 'none';
  /** the Workshop's levels: the slots it fits and the highest upgrade */
  levels: { slots: ('front' | 'back')[]; maxUp: number }[];
  /** prices in Scrap: a fit, and each upgrade (the first to +1, then +2...) */
  price: { fit: number; up: number[] };
}
export interface GeneBank {
  levels: { limit: number; slots: ('front' | 'back' | 'sig')[] }[];
  price: { base: number; perCost: number };
  inherit: number;
}
export interface GeneTrait {
  name: string;
  d: string;
  fx: FxRow[];
}
/** RL-13: modifiers.json: a run's Expedition (one row each, I first) and its challenges (logic/modifiers.js) */
export interface Modifier {
  name: string;
  d: string;
  fx: FxRow[];
  /** a challenge: the condition for it to be offered at the mast */
  when?: string;
}
export type ChallengeId = 'mono' | 'noheal' | 'noperks' | 'fragile';
export interface ModifiersData {
  about?: string;
  expeditions: Modifier[];
  challenges: Partial<Record<ChallengeId, Modifier>>;
}
/** RL-14: factions.json: one of the runs' enemy factions (logic/factions.js) */
export interface FactionBot {
  name: string;
  gem: string;
  torso: string;
  armL: string;
  armR: string;
  legs: string;
  weight: number;
}
export interface Faction {
  name: string;
  short?: string;
  bots: Record<DataId, FactionBot>;
  /** wild bots: the chance a run route's wild one is a bot, from which map row, in which biomes */
  wild: { chance: number; fromRow: number; biomes: string[] };
  /** its agents' classes (events.json) and how many bots each fields [least, most] */
  agents: { classes: string[]; bots: [number, number] };
  /** a scrapyard place's agents [least, most] and their classes */
  scrapyard: { trainers: [number, number]; classes: string[] };
  /** a salvage pick: up to `parts` of the beaten bots' parts and Scrap (scrap + scrapPerBot a bot after the first) */
  salvage: { parts: number; scrap: number; scrapPerBot: number };
}
/** RL-14b: bosses.json: one boss phase, fired once when its HP falls to `at` of the most */
export interface BossPhase {
  at: number;
  shield?: number;
  stages?: Record<string, number>;
  breaks?: 'armL' | 'armR' | 'legs';
  say?: string;
}
/** RL-14b: bosses.json: a run boss that is a robot fought as an Alpha (battle-engine.js makeBossRobot) */
export interface BossDef {
  name: string;
  expeditions: number[];
  who?: string;
  fighter: { gem: string; torso: string; armL: string; armR: string; legs: string };
  bots?: Partial<Record<'torso' | 'armL' | 'armR' | 'legs', string>>;
  boss: { hp: number; st: number; levels: number };
  phases: BossPhase[];
  /** the battle's first line ({name}) */
  call?: string;
  join?: string;
  /** the join intro's glow (else its gem's colour) */
  glow?: string;
  win?: string;
  rewards?: { parts?: number };
  story?: string;
  /** its story script plays only while the story's chapter is this */
  chapter?: number;
}
/** TW-3: quests.json: a run's quests (logic/run-quests.js) */
export type QuestKind = 'catch' | 'trainers' | 'parcel' | 'miniboss';
export interface QuestKindRule {
  weight: number;
  /** [fewest, most] to do ({n}) */
  goal: [number, number];
  /** the quest list's line ({type}, {n}) */
  title: string;
}
export interface QuestText {
  id: string;
  kind: QuestKind;
  /** the giver's offer ({type}, {n}) */
  ask: string;
}
export interface QuestsData {
  about?: string;
  /** the most held at once */
  held: number;
  kinds: Record<QuestKind, QuestKindRule>;
  texts: QuestText[];
  say: Record<'take' | 'yes' | 'no' | 'full' | 'taken' | 'none' | 'done' | 'empty' | 'fail', string>;
  /** residents track RS-2: each resident's favour (no kind: the free first one, whose talk is the invite) */
  favours: Record<string, QuestFavour>;
  /** RS-2: a resident's lines in a run ({name}, {title}) */
  invite: Record<
    'come' | 'take' | 'yes' | 'taking' | 'no' | 'held' | 'thanks' | 'none' | 'done' | 'moving' | 'title',
    string
  >;
}
/** quests.json favours: what a resident asks before moving to Copperleaf (residents track RS-2) */
export interface QuestFavour {
  kind?: QuestKind;
  /** their offer ({type}, {n}) */
  ask: string;
}
/** festivals.json (hub track HB-10e): Copperleaf's festivals and market days, and what their market is paid in */
export interface FestivalsData {
  about?: string;
  /** a currency kept between runs (currencies.json) */
  cur: DataId;
  festivals: Record<DataId, Festival>;
}
/** a festival or market day: on by a condition (milestone), the calendar (date) or the returns (market) */
export interface Festival {
  name: string;
  kind: 'milestone' | 'date' | 'market';
  /** milestone: while this holds */
  when?: string;
  /** date: its first day, MM-DD, and how many days */
  from?: string;
  days?: number;
  /** market: every this-many-th return */
  every?: number;
  /** the notice board's line while it is on */
  about: string;
  /** the square's day while it is on (rules.json square.day's rows) */
  day: { k: string; from: number; to: number; share: number; stops: string[] }[];
  /** the festival market: an item or a coin, how many each occasion, the price */
  stock: { item?: DataId; coin?: DataId; n: number; price: number }[];
}

/** residents.json: someone a run can invite to Copperleaf (residents track RS-1) */
export interface Resident {
  name: string;
  role: string;
  /** a buildings.json key, a Copperleaf building's catalogue key, or 'house' (a free cottage) */
  home: string;
  /** the free first resident, offered while nobody lives in Copperleaf */
  first?: true;
  /** where a run can meet them, and their weight among those left (0: not yet) */
  meet: { where: ('town' | 'event')[]; weight: number };
  /** their service's levels above 1: unlocks.json rows sold at their home, granting {resident, level} 2, 3, ... (RS-4) */
  levels: string[];
  /** RS-4: what their service does at each level, Lv 1 first (it comes with moving in) */
  service?: ResidentService[];
  about: string;
}
/** RS-4: one level of a resident's service (residents.json `service`) */
export interface ResidentService {
  about: string;
  /** the one power level */
  power?: true;
  /** wares their hub shop sells from this level on, priced in their home's currency */
  stock?: { item?: DataId; coin?: DataId; price: number }[];
  /** rerolls of a run shop's stock a run */
  reroll?: number;
  /** a rumour at takeoff: a hidden node's type, or which place hides a side area */
  rumour?: 'node' | 'side';
  /** items into the bag at each takeoff */
  items?: Record<DataId, number>;
  /** effect rows on every run while they hold the level */
  fx?: FxRow[];
}
/** events.json: a run's events, loot tables and trainer classes (roguelite track RL-12b; logic/encounters.js) */
export interface EventsData {
  loot: Record<DataId, Record<DataId, number>>;
  classes: Record<DataId, TrainerClass>;
  events: Record<DataId, RunEvent>;
}
/** rewards.json: a card of the reward pick (roguelite track RL-12b; logic/rewards.js) */
export interface RewardRow {
  kind: 'item' | 'candy' | 'evo' | 'tutor' | 'held';
  item?: DataId;
  pyramid?: DataId;
  n?: number;
  weight: number;
}
/** RL-S1: banter.json: one of the story director's lines (logic/story-pick.js) */
export interface BanterLine {
  who:
    | 'chosen'
    | 'kappi'
    | 'juniper'
    | 'back_lost'
    | 'leader'
    | 'bureau'
    | 'rival'
    | 'thanks_chosen'
    | 'thanks_kappi'
    | 'thanks_juniper'
    | 'square_won'
    | 'square_lost'
    | 'square_fest';
  when?: string;
  priority: number;
  once?: boolean;
  cooldown?: number;
  must?: boolean;
  script: string[];
}
/** events.json classes: a kind of trainer (route trainers, the `foe` command) */
export interface TrainerClass {
  name: string;
  who: DataId;
  team: [number, number];
  sight: string;
  lose: string;
  /** RL-S1: one of the Bureau's agents */
  bureau?: 1;
  /** RT-2: the spot kinds a route trainer of the class stands on first (logic/route-trainers.js ROUTE_SPOTS) */
  likes?: ('roadside' | 'pinch' | 'bridge' | 'pocket' | 'clearing' | 'deadend')[];
}
/** events.json events: one event, its intro and 2-3 options */
export interface RunEvent {
  title: string;
  intro: string[];
  weight: number;
  repeat?: boolean;
  biomes?: DataId[];
  /** SP-6: a condition read when a waystation's event is drawn: only then may it be this one */
  when?: string;
  options: RunEventOption[];
  /** residents track RS-2: only while the run's resident can be met at an event; `invite` invites them */
  resident?: true;
}
export interface RunEventOption {
  text: string;
  need?: string;
  needText?: string;
  cost?: number;
  /** SP-6: DNA paid when it is picked */
  dna?: number;
  then: string[];
}
/** perks.json: a Perk (roguelite track RL-12): held for one run, its effect rows apply while it is held */
export interface Perk {
  /** what the player reads */
  name: string;
  /** what it does, in one sentence */
  d: string;
  rarity: PerkRarity;
  fx: FxRow[];
}

/** currencies.json: one of the game's six currencies (roguelite track RL-11; RL-S2: Beans; SP-3: DNA) */
export type CurrencyId = 'money' | 'research' | 'scrap' | 'crests' | 'beans' | 'dna';
export interface Currency {
  /** what the player reads; `long` where the short name is a sign ($); `one` for a count of one */
  name: string;
  long?: string;
  one: string;
  /** its icon (ui-run-kit.js pb-coin) */
  icon: string;
  /** run: the run's working field (saveData.se); meta: saveData.meta.<id>, kept between runs */
  kept: 'run' | 'meta';
  about: string;
}

/** buildings.json: a hub building, upgraded with one currency kept between runs (roguelite track RL-11) */
export interface HubBuilding {
  name: string;
  currency: Exclude<CurrencyId, 'money'>;
  /** the act of its building in Copperleaf: its sheet sells its rows, its label shows its level */
  act?: string;
  /** its highest level (1 is where it starts); each level above is an unlocks.json row */
  levels: number;
  /** not built yet: on the Lab board as coming later */
  soon?: true;
  about: string;
}

/** unlocks.json: what an unlock gives (exactly one kind) */
export type UnlockGrant =
  | { building: string; level: number }
  /** RS-4: a resident's service level (2 and up; Lv 1 comes with moving in) */
  | { resident: string; level: number }
  | { shop: string }
  | { biome: string }
  | { research: number }
  | { scrap: number }
  | { crests: number }
  | { beans: number }
  | { dna: number };
/** unlocks.json: one row of the unlock table (roguelite track RL-11): sold at a building (at + cost, in its currency;
 * the Lab's rows are its board) or earned when a condition holds (when) */
export interface Unlock {
  name: string;
  about: string;
  at?: string;
  cost?: number;
  when?: string;
  requires?: string[];
  grant: UnlockGrant;
}

/** uiTheme.json: the UI's look (UI track UI-1; version 2 in UI-3, for the Studio's UI section) */
export type UiRole =
  | 'ground'
  | 'surface'
  | 'text'
  | 'text2'
  | 'line'
  | 'primary'
  | 'goldA'
  | 'goldB'
  | 'danger'
  | 'hpOk'
  | 'hpMid'
  | 'hpLow';
export interface UiSurfaceSide {
  glass?: number;
  highlight?: number;
  edgeHi?: number;
  edgeLo?: number;
  shadowTint?: string;
}
export interface UiShadows {
  raisedY?: number;
  raisedBlur?: number;
  raisedAlpha?: number;
  raisedNear?: number;
  floatY?: number;
  floatBlur?: number;
  floatAlpha?: number;
  floatNear?: number;
}
export type UiFamily = 'panel' | 'card' | 'button' | 'action' | 'tab' | 'toast' | 'bubble';
export interface UiFamilyShape {
  kind?: 'cut' | 'rounded' | 'square';
  size?: 'cutSm' | 'cutMd' | 'cutLg';
  corners?: ('tl' | 'tr' | 'br' | 'bl')[];
  radius?: number;
}
export type UiEase = [number, number, number, number];
export interface UiLook {
  /** a preset's name in the Studio */
  name?: string;
  color?: { light?: Partial<Record<UiRole, string>>; dark?: Partial<Record<UiRole, string>> };
  surface?: { blur?: number; saturate?: number; light?: UiSurfaceSide; dark?: UiSurfaceSide };
  /** the glass panels' box shadows per side (UI-3) */
  depth?: { light?: UiShadows; dark?: UiShadows };
  /** the angular parts' drop shadows (UI-3) */
  drop?: UiShadows;
  shape?: {
    cutSm?: number;
    cutMd?: number;
    cutLg?: number;
    slant?: number;
    stepped?: boolean;
    step?: number;
    families?: Partial<Record<UiFamily, UiFamilyShape>>;
  };
  space?: Partial<Record<'s1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 'gutter', number>>;
  type?: {
    voice?: 'Jersey 15' | 'Pixelify Sans';
    prose?: 'Oxanium' | 'Chakra Petch';
    voiceScale?: number;
    scale?: number;
    lineHeight?: number;
  };
  motion?: {
    fast?: number;
    base?: number;
    slow?: number;
    stagger?: number;
    easeOut?: UiEase;
    easeIn?: UiEase;
    spring?: UiEase;
  };
  /** UI-11: the colour code; only the defaults set it */
  signals?: UiSignals;
}
/** UI-11: the colour code's ids (logic/signals.js UI_SIGNALS): the eight families, the three statuses, the rarity tiers */
export type UiSignalId =
  | 'good'
  | 'bad'
  | 'caution'
  | 'value'
  | 'special'
  | 'growth'
  | 'machine'
  | 'bio'
  | 'brn'
  | 'par'
  | 'slp'
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'mythical';
/** UI-11: the colour code, the same in every palette: a fill (--sig-<id>) and a text shade per side (--sig-<id>-text) */
export interface UiSignals {
  fill?: Partial<Record<UiSignalId, string>>;
  light?: Partial<Record<UiSignalId, string>>;
  dark?: Partial<Record<UiSignalId, string>>;
}
export interface UiTheme {
  version: 2;
  defaults: UiLook;
  presets?: Record<string, UiLook>;
  /** per screen: colour and shape only */
  overrides?: Record<string, Pick<UiLook, 'color' | 'shape'>>;
}

/** RL-R2: a field move (fieldMoves.json): what opens a run's side area (logic/run-side.js) */
export interface FieldMove {
  name: string;
  /** the type a Billie needs, and whose badge (meta.badges, by the type's id in lower case) */
  type: string;
  obstacle: 'shore' | 'boulder' | 'thorns';
  /** the side area's biome */
  biome: string;
  /** its places are ridden (water walkable) */
  ride?: boolean;
  areas: string[];
  look: string;
  needBadge: string;
  needType: string;
  ask: string;
  used: string;
  out: string;
}
/** WM-7: arenas.json: the leaders' arenas, a raised, fenced ring on a mini-boss's place and the boss's
 * (logic/arena-gen.js) */
export interface ArenasData {
  about?: string;
  sizes: { leader: ArenaSize; boss: ArenaSize };
  /** how many route trainers stand on the road before a leader's ring (logic/route-trainers.js) */
  trainers: number;
  /** by the leader's type, and `bureau` and `plain` */
  themes: Record<string, ArenaTheme>;
}
export interface ArenaSize {
  /** half its width (an octagon), metres */
  r: number;
  /** its height over the road, metres */
  rise: number;
  /** a leader's ring: how far from the east exit along the main road its middle stands, metres */
  back?: number;
}
export interface ArenaTheme {
  name: string;
  /** scenery.json terrains: the ring's ground and its outer metre's */
  ground: string;
  rim: string;
  /** scenery.json props with a box: the fence round the rim and the gate across the east ramp */
  fence: string;
  gate: string;
  /** scenery.json props: at its corners, and by its ramps outside the fence */
  posts: string;
  dress: string[];
}
/** RT-3: setPieces.json: small groups of existing props placed as a unit on a laid-out place's spots
 * (logic/mapgen.js mapgenStagePieces), in the piece's own metres (x across its front, z back from it) */
export interface SetPiecesData {
  about?: string;
  /** how many a laid-out place gets, at least and at most (logic/run-scenes.js runPiecesOf) */
  perPlace: [number, number];
  pieces: Record<DataId, SetPiece>;
}
export interface SetPiece {
  name: string;
  /** the spot kinds it may take (scene.spots) */
  on: ('roadside' | 'clearing' | 'jetty')[];
  /** every prop lies within this many metres of its origin (the middle of its front) */
  r: number;
  /** draw weights by biome, `default` for one not listed */
  biomes: Record<string, number>;
  /** a layout plan's multiplier on its weight */
  /** RL-14: draw weights on a place of a kind (the scene's site dial: a run's scrapyard), in place of its biome's */
  sites?: Record<string, number>;
  plans?: Record<string, number>;
  props: SetPieceProp[];
  people?: SetPiecePerson[];
  /** RT-4b: animals living in it, kept to an area in its own metres [x0, z0, x1, z1] */
  life?: { k: string; n: number; area: [number, number, number, number] }[];
}
export interface SetPieceProp {
  /** a scenery.json prop */
  k: string;
  x: number;
  z: number;
  /** degrees, on top of the piece's own turn (models only: a picture stays facing you) */
  rot?: number;
  /** a sign's words */
  say?: string;
  /** stands on water (a boat) */
  water?: boolean;
}
/** someone who stands in a piece: tapped, opens an event once a run, then says `say` */
export interface SetPiecePerson {
  who: string;
  x: number;
  z: number;
  event?: string;
  say?: string;
}
/** WA-6b: the Waterfall climb (fieldMoves.json waterfall): a field move used in the walk on a fall marked climb: 1 */
export interface FieldClimb {
  name: string;
  /** the type of the Billie that climbs */
  type: string;
  /** the badges it needs, every one kept (meta.badges by type) */
  badges: string[];
  look: string;
  needBadge: string;
  needType: string;
  ask: string;
  used: string;
  top: string;
}
/** RL-R2: rules.json run.side: the chance a run has a detour or an alternate path (never both), a detour's places, an
 * alternate path's rows and the chance it ends at a boss of its own, each move's weight and the lean toward a move of
 * the region's types */
export interface RunSideRules {
  detour: number;
  alt: number;
  places: [number, number];
  altRows: [number, number];
  altBoss: number;
  moves: Record<string, number>;
  lean: number;
}
/** RL-S2: rules.json run.rival: Blake's meetings in a run and his team (placeholders until the owner answers) */
/** ON-2: where a friend's ghost team waits (rules.json run.ghost) */
export interface GhostRules {
  /** the node types it can stand in for, in order: the first the band has */
  on: string[];
  /** with none of those: a type it takes only on a row that keeps another of it ('town') */
  spare?: string;
  /** its rows: [from, to) as a share of the map's rows */
  band: [number, number];
  /** its ace's levels over the row's top wild level, what beating it pays (Moneys), the trainer look it wears */
  up: number;
  reward: number;
  who: string;
}

/** ON-2: the daily and weekly runs (rules.json run.boards; logic/daily.js) */
export interface BoardRules {
  /** the daily: its Expedition and challenges (modifiers.json ids) */
  daily: { expedition: number; challenges: string[] };
  /** the weekly: its Expedition drawn from [lo, hi], and [lo, hi] picks of `challenges` */
  weekly: { expedition: [number, number]; challenges: string[]; picks: [number, number] };
}

export interface RivalRules {
  /** meetings a run by Expedition (index 0 = Expedition I; past the end, the last) */
  meet: number[];
  /** the node types he can stand in for, in order: the first a band has */
  on: string[];
  /** meeting k's rows: [from, to) as a share of the map's rows */
  bands: [number, number][];
  /** his team: Billies at the first meeting, one more per `grow` past meetings, at most `max` */
  size: number;
  grow: number;
  max: number;
  /** levels over the row's top wild level, and what beating him pays (Moneys) */
  up: number;
  reward: number;
}

/** RL-S2: relations.json: what a gift costs and gives, and each hub person's levels (logic/relations.js) */
/** ON-3: showcase.json: the weekly themes (one a week from Monday 00:00 UTC, round again) and the ribbons the
 * theme's top entries earn, first place first (logic/showcase.js) */
export interface ShowcaseData {
  about?: string;
  ribbons: string[];
  themes: ShowcaseTheme[];
}
export interface ShowcaseTheme {
  id: string;
  name: string;
  d: string;
  /** what a Billie needs to enter: an abomination or Unstable splice, Augments, a splice, a type (`type`), anything */
  need: 'abom' | 'aug' | 'graft' | 'type' | 'any';
  type?: string;
}
export interface RelationsData {
  gift: { cost: number; points: number; favour: number };
  people: Record<string, { levels: RelationLevel[]; favour?: RelationFavour }>;
}
/** RL-S2 part B: what a hub person asks of you on a run: its quest (story.json quests, stages asked and done), the
 * condition that says it is done (read on the way home), the points it gives (else gift.favour) */
export interface RelationFavour {
  quest: string;
  check: string;
  points?: number;
}
/** RL-S2: one level of a person's: the points it takes and what it brings */
export interface RelationLevel {
  at: number;
  /** effect rows on every run while held (as a Perk's) */
  fx?: FxRow[];
  /** items and pyramids into the bag at each takeoff while held */
  items?: Record<string, number>;
  pyramids?: Record<string, number>;
  /** a wardrobe piece given once, when the level is reached */
  wardrobe?: string;
}
