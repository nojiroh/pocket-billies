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
  rarities: Record<string, { totals: number[] }>;
  lines: Line[];
  /** the world map's places, in node order */
  locations: LocationData[];
  regions: Region[];
  pools: Record<DataId, Pool>;
  /** the egg tiers, keyed by the distance in km that hatches them ('2', '5', '10') */
  eggs: Record<string, EggTier>;
  coins: Record<DataId, Coin>;
  items: Record<DataId, Item>;
  jobs: Record<DataId, Job>;
  people: Record<DataId, Person>;
  shops?: Record<DataId, Shop>;
  trainers?: Record<DataId, Trainer>;
  rules: Rules;
  battleStages: Record<DataId, BattleStage>;
  scenery: Scenery;
  /** every walkable map: towns, routes, rooms (int_*) and test maps (test_*) */
  maps: Record<DataId, MapData>;
  /** without roads the locations make one chain, in order (game-data.js) */
  roads?: Road[];
  engine: Engine;
  wardrobe: Wardrobe;
  /** fishing spots' encounter lists, keyed by the water ('pond', 'sea'...) */
  fishing: Record<string, Pool>;
  moods: Record<DataId, Mood>;
  lore: Lore;
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
}

/* ---------- Billies: types, stats, moves, lines ---------- */

export interface Meta {
  title: string;
  version: number;
  dataVersion: number;
  notes: string;
  endText: string;
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
  hold?: number;
  missCost?: number;
  rent?: number;
}

/** an evolution. The data uses 'lvl' (at a level) and 'split' (a split line's middle stage, by the Hype/Build rule);
    the code still knows the older kinds (game-state.js canEvolve, evolutionHint) */
export type Evolution =
  | { k: 'lvl' | 'split'; at: number }
  | { k: 'buddy'; steps: number }
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
  catchRate?: number;
  cat?: string[];
  ht?: number[];
  wt?: number[];
  hab?: string[];
  diet?: string[];
  bio?: string[];
  note?: string[];
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
  /** the older chain's road length to it (roads.json has the lengths) */
  cost?: number;
  t: string;
  biome: string;
  mood: DataId;
  blurb: string;
  /** where it is on the world map, degrees */
  lon: number;
  lat: number;
  region?: string;
  music?: string;
  /** a key of gameData.shops */
  shop?: DataId;
  boutique?: string;
  /** a gym badge (a trainer's seat id) needed to go on */
  gate?: string;
  gateText?: string;
  ride?: number;
  noFly?: number;
  /** the glass lift's other end */
  lift?: DataId;
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

/** roads.json: [from node, to node, length in steps, the two ends] */
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

export interface Region {
  name: string;
  t: string;
  blurb: string;
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
  /** on a lite map (gamedata.js): the ground kinds and props it uses, so its look can start before its file comes */
  _lite?: { tiles: string; props: { k: string; v?: number; roof?: string }[] };
  /** the rest: the look (sky, haze, cam, moods), life, water, rails... read by the walk view and the renderer */
  [key: string]: any;
}

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
  /** variant */
  v?: number;
  act?: string;
  say?: string;
  label?: string;
  /** this one's model recipe instead of its kind's */
  model?: string;
  [key: string]: any;
}

/* ---------- encounters, eggs, money, items, jobs ---------- */

/** pools.json (and fishing.json): a level range and weighted species */
export interface Pool {
  lv: [min: number, max: number];
  list: WeightedSpecies[];
}

/** eggs.json: an egg tier */
export interface EggTier {
  /** steps to hatch */
  need: number;
  lv: number;
  list: WeightedSpecies[];
}

/** coins.json: a coin you tax Billies with */
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
  mint?: boolean;
}

/** jobs.json: a day job a boxed Billie can take */
export interface Job {
  n: string;
  where: string;
  /** what a shift pays: ['item', item id, n], ['coin', coin id, n] or ['se', 'se', dollars] */
  out: [kind: 'item' | 'coin' | 'se', key: string, amount: number];
  pay: string;
  quip: string;
}

/** shops.json */
export interface Shop {
  name: string;
  keeper: string;
  /** the keeper's look, a key of gameData.people */
  who: DataId;
  greeting: string;
  stock?: { item?: DataId; coin?: DataId; price: number }[];
  /** 'wardrobe' for a clothes shop */
  kind?: string;
  sells?: string[];
  thanks?: string[];
}

/* ---------- people and trainers ---------- */

/** people/<id>.json (person.schema.json): how a person looks: colours and a hair style, or a full look */
export interface Person {
  look?: PersonLook;
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
  /** their look, a key of gameData.people ('gini' when unknown) */
  who: DataId;
  /** their battle stage, a key of gameData.battleStages */
  battleStage?: DataId;
  /** the location where they wait */
  node: LocationNode;
  /** they block the road until beaten */
  blocks?: boolean;
  team: TrainerBilly[];
  reward: number;
  /** an egg tier they hand out */
  egg?: number;
  market?: { k: string; n: number } | null;
  marketText?: string;
  lines: string[];
  win: string;
  lose: string;
  hint?: string;
  blockTitle?: string;
  blockText?: string;
  /** a gym badge */
  seat?: Seat | null;
  intro?: string[];
  intro0?: string[];
  double?: boolean;
  /** only there once you've beaten this trainer */
  after?: DataId;
  /** only battles in a story scene; waits on no location */
  tutorial?: boolean;
  clue?: string;
  ending?: number;
  endLines?: [who: string, line: string][];
  v47region?: number;
}

/** what game-data.js adds to each trainer at load */
export interface TrainerEntry extends Trainer {
  /** its key in gameData.trainers */
  id: DataId;
}

/** a trainer's Billie: a species, or '@rival' ('@rival1', '@rival2': evolved) for the starter that beats yours */
export interface TrainerBilly {
  sp: SpeciesId;
  lvl: number;
  moves?: MoveId[];
}

/** a gym badge */
export interface Seat {
  id: string;
  title: string;
  coin: DataId;
  coins: Record<DataId, number>;
  items: Record<DataId, number>;
  rewardText: string;
  unlockText: string;
}

/* ---------- rules ---------- */

/** rules.json: the numbers the game plays by */
export interface Rules {
  /** 'walk': you walk the roads yourself */
  travel: string;
  start: {
    /** money */
    se: number;
    coins: Record<DataId, number>;
    items: Record<DataId, number>;
    /** the starters' line ids */
    starters: DataId[];
    starterLevel: number;
    starterEgg: number;
    starterEncounters: number;
    /** your starter's line -> the rival's species */
    rival: Record<DataId, SpeciesId>;
    /** where a new game starts */
    locationId: DataId;
  };
  steps: {
    stepsPerKm: number;
    /** what a step earns: rate up to upTo steps a day (0: no limit) */
    brackets: { upTo: number; rate: number }[];
    encounterEverySE: number;
    maxEncounters: number;
    goldOdds: number;
    restCost: number;
    alphaOdds: number;
  };
  progression: {
    xpFactor: number;
    maxLevel: number;
    buddyStepsPerXp: number;
    teamSize: number;
    moveSlots: number;
    /** XP yield by stage */
    xpYield: number[];
    trainerXpMult: number;
    teamXpShare: number;
  };
  eggs: {
    capacity: number;
    slots: number;
    goldOdds: number;
    goldOdds10: number;
    mythOdds: number;
    mythSpecies: SpeciesId;
    dropChance: number;
    dropTiers: Record<string, number>;
  };
  jobs: { stepsPerPay: number; maxPending: number; positions: number };
  battle: {
    stab: number;
    critChances: number[];
    critMult: number;
    rollMin: number;
    cryptoRollMin: number;
    cryptoRollMax: number;
    mediaCrit: number;
    financeRamp: number;
    financeRampTurns: number;
    retailSynergy: number;
    oilShockMult: number;
    drainFraction: number;
    rentFraction: number;
    auditSkip: number;
    hypeTurns: number;
    hypeSelfHit: number;
    subpoenaMin: number;
    subpoenaMax: number;
    stageMax: number;
    aiSmart: number;
    loseFee: number;
    shockType: TypeId;
    shockTurns: number;
    shockName: string;
    spinType: TypeId;
    spinTurns: number;
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
    subpoena: number;
    status: number;
    spin: number;
    ring: number;
    edge: number;
    /** the lines that shrug off a Copper Coin (its odds times luxuryPenny) */
    luxury: DataId[];
    luxuryPenny: number;
    offerChance: number;
    offerMin: number;
    offerMax: number;
    integrityStep: number;
    integrityMax: number;
    alpha: number;
  };
  ride: { minHeight: number; types: TypeId[] };
  fishing: { biteMin: number; biteMax: number; reactTime: number; reelTime: number; goldOdds: number };
  /** the legendary encounters, one per map (scene is a map id) */
  legends: { sp: SpeciesId; scene: DataId; lvl: number; title: string; text: string; line: string }[];
  /** phase 16: part sizes, weight and Prime (rules.js) */
  parts: PartRules;
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
  [key: string]: any;
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
