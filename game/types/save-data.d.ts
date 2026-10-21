// Phase 04e: the save's format, for the type check (npm run typecheck). Types only: nothing here runs.
// The save is what game-state.js newSave() makes and migrate() fills out and checks, kept as JSON in this browser
// (localStorage) and, when signed in, on the account (account.js stores it as one string). A backup file is
// { game: 'Pocket Billies', format: 1, save } (settings-screen.js exportSave; validSave checks an import).
// Save format 2 (SAVE_VERSION, phase 05): the player's travel along the roads is `trip` (was `route`); format 4
// (roguelite track RL-3) adds meta, run and ranch. A save of another format is not loaded; the game says so and keeps
// it aside.
// Precise where the code reads a field; the parts other modules keep in the save (story, things to do, postcards,
// the wardrobe) are loose.

import type { DataId, LocationNode, MoveId, PersonLook, SpeciesId } from './game-data';

/** game-state.js saveData */
export interface SaveData {
  /** the save format (game-state.js SAVE_VERSION) */
  saveVersion: number;
  /** the game version that wrote it (PB_VERSION) */
  gameVersion: string;
  /** how you look (person-art.js cleanLook); null before the opening */
  avatar: PersonLook | null;
  preferences: Preferences;
  /** past the opening, with a starter */
  started: boolean;
  /** 'me' since alpha 0.5 ('boy' and 'girl' before); null before the opening */
  gender: string | null;
  /** your starter's line id */
  starter: DataId | null;
  team: Billy[];
  box: Billy[];
  /** phase 17: robot parts and spare gems you own that no robot is using */
  parts: PartInstance[];
  /** species seen and caught: 1 */
  seen: Record<SpeciesId, number>;
  caught: Record<SpeciesId, number>;
  /** money, dollars */
  se: number;
  /** how many of each coin and item you have (every key of gameData.coins and gameData.items) */
  coins: Record<DataId, number>;
  items: Record<DataId, number>;
  /** where you are and where you're going */
  trip: Trip;
  /** never set any more (always null) */
  mapSeen: null;
  /** phase 08: the wild Billies on each place's map, by location id (rules.js encountersHere) */
  wild: Record<string, WildStock>;
  /** your buddy's uid */
  buddy: string | null;
  /** trainers beaten (by id) and story flags: 1 */
  flags: Record<string, number>;
  /** badges (seat ids) */
  seats: string[];
  /** locations you've been to: node -> 1 */
  visited: Record<LocationNode, number>;
  /** the last encounter number */
  serial: number;
  eggs: Egg[];
  /** Date.now() at the last save */
  savedAt: number;
  /** the trainer card: ID number, start date (0: unknown) and eggs hatched */
  tid: number;
  since: number;
  hatched: number;
  /** milliseconds played (title.js) */
  playMs?: number;
  /** story flags (story.js, lore.js) */
  story?: Record<string, any>;
  /** fish caught and the like (fishing.js); walked: metres walked outdoors (rules.js addWalked) */
  stats?: Record<string, number>;
  /** things to do: stamps, requests, the home (things-to-do.js) */
  x?: {
    stamps?: Record<string, any>;
    reqs?: Record<string, any>;
    home?: { slots: Record<string, any>; own: string[] };
    /** the places you've been in today (by node) */
    visits?: { date: string; ids: number[] };
  };
  /** postcards collected (postcards.js) */
  cards?: Record<string, any>;
  /** clothes owned and saved outfits (dressing-room.js) */
  wardrobe?: { owned: Record<string, any>; outfits: any[] };
  /** roguelite track RL-3 (save format 4): what lasts between runs, the run in progress (null in the hub; while it is
      on, team, se, items, coins, trip, wild, eggs, flags, seats and visited are the run's), the ranch */
  meta: Meta;
  run: Run | null;
  ranch: Ranch;
}

/** roguelite track RL-3: what lasts between runs (logic/meta-state.js) */
export interface Meta {
  /** the unlock currency, the building material, the rare boss currency (money is saveData.se) */
  capital: number;
  scrap: number;
  seals: number;
  /** unlock ids: 1 (unlocks.json, RL-11) */
  unlocks: Record<string, 1>;
  /** hub building id -> level (buildings.json, RL-11) */
  buildings: Record<string, number>;
  /** runs ended (won or lost) and runs won */
  runs: number;
  wins: number;
  /** the highest difficulty tier (Bracket) open, from 1 */
  tier: number;
}

/** roguelite track RL-3: the ranch, a hub building (logic/ranch-state.js; filled in RL-9 and RL-10) */
export interface Ranch {
  /** uids of Billies kept at the ranch (they are in saveData.box) */
  pens: string[];
  /** Billies training between runs: uid, Date.now() when training started */
  trainees: { uid: string; at: number }[];
  /** breeding pairs: the parents' uids, the mode, when it started and when the egg is ready (Date.now()) */
  nursery: { a: string; b: string; mode: 'safe' | 'risky'; at: number; ready: number }[];
  /** passive income: per hour, banked so far, the last time it was counted (Date.now(); only moves forward) */
  income: { rate: number; bank: number; lastAt: number };
}

/** roguelite track RL-3: one node of a run's map (logic/run-map.js makes them, RL-6) */
export interface RunNode {
  /** a nodeTypes.json id (RL-6): landing, route, town, miniboss, boss... */
  type: string;
  /** the row (0 the landing) and the lane in it */
  row: number;
  lane: number;
  /** indices into the map's nodes this one leads to */
  to: number[];
  /** shown on the bowl: 0 hidden, 1 a '?' pin, 2 its type icon */
  seen?: number;
  /** its biome (a biomes.json id): its scene's look and its weather's climate */
  biome?: string;
}

/** roguelite track RL-6: a run's node map (logic/run-map.js runMapMake): nodes row by row, west to east */
export interface RunMap {
  nodes: RunNode[];
}

/** what a run changes in the working fields, copied when it starts and put back when it ends */
/** RL-8: a run battle's foe as it began (logic/run-state.js validRunFoe) */
export interface RunFoe {
  kind: 'wild' | 'trainer';
  fmt: 'single' | 'double' | 'alpha';
  team: Billy[];
  qid?: string;
  tid?: string;
  area?: string;
  fished?: 1;
}
export interface RunStart {
  team: Billy[];
  se: number;
  items: Record<DataId, number>;
  coins: Record<DataId, number>;
  trip: Trip;
  wild: Record<string, WildStock>;
  eggs: Egg[];
  flags: Record<string, number>;
  seats: string[];
  visited: Record<LocationNode, number>;
}

/** roguelite track RL-3: the run in progress (logic/run-state.js); null in the hub */
export interface Run {
  /** the run's seed (10 base32 characters; 'd' + a UTC date for a daily); everything else regenerates from it */
  seed: string;
  /** the difficulty tier (Bracket) */
  tier: number;
  /** the map generator's version when the run started (a run made by another version is abandoned) */
  mapgenV: number;
  /** the node map; null until the run gets it at the mast (logic/run-map.js runMapStart) */
  map: RunMap | null;
  /** what is happening, and the battle being fought (its battle number, -1 for none: a resume restarts it from
      the seed). Where the player is stays saveData.trip.node: 0 Copperleaf, i + 1 the map's node i */
  /** RL-8: won, at the payout (1 won, 0 lost or given up) */
  /** RL-8: in a battle, its foe as it began (a reload starts the same battle again) */
  at: { phase: 'fly' | 'walk' | 'battle' | 'menu' | 'payout'; battle: number; won?: 0 | 1; foe?: RunFoe };
  /** the day (one per node arrival, backtracking included) and the deadline day */
  clock: number;
  deadline: number;
  /** each node's weather by day: forecast[world node][day - 1] (a weather id; world node i + 1 is the map's node i,
      and Copperleaf's, world node 0, is empty) */
  forecast: string[][];
  /** relic ids held, the offer shown (saved before it is shown), modifier ids */
  relics: string[];
  offer: string[] | null;
  mods: string[];
  /** the hub's working fields as the run started */
  start: RunStart;
  /** counters, so a resumed run carries on its random streams and ids */
  uidN: number;
  battleN: number;
  /** the nodes arrived at, in order (map indices); the player's choices, in order */
  path: number[];
  log: string[];
  /** Billies released during the run (paid as Capital at the payout) */
  released: { sp: SpeciesId; lvl: number }[];
  /** the one-time hints already shown */
  hints: Record<string, 1>;
}

/** the player's travel: where you are, and the locations still ahead (the gold arrows' guide) */
export interface Trip {
  node: LocationNode;
  plan: LocationNode[];
}

/** settings kept in the save (a new game on this device keeps them) */
export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  motion: 'system' | 'reduced' | 'full';
  fps: 30 | 60 | 90 | 120;
  effects: 'full';
  /** graphics: 'sharp' (best) or 'smooth' */
  aim?: 'sharp' | 'smooth';
  mute?: boolean;
  /** volumes, 0-1 */
  master?: number;
  music?: number;
  sfx?: number;
  world?: number;
  amb?: number;
  haptics?: boolean;
  tilt?: boolean;
  bigTargets?: boolean;
  textSize?: string;
  contrast?: string;
  flashes?: string;
  lang?: string;
  expert?: boolean;
  control?: string;
  /** phase 08: a full push (stick, d-pad, keys) and tap-to-walk run */
  alwaysRun?: boolean;
  skipTitle?: boolean;
  cardClosed?: any;
  /** the player's own engine settings: group -> setting -> value (engine/settings.js) */
  eng?: Record<string, Record<string, number>>;
  [key: string]: any;
}

/** a Billie you have (game-state.js makeBilly) */
export interface Billy {
  uid: string;
  sp: SpeciesId;
  lvl: number;
  xp: number;
  hp: number;
  /** a status id (gameData.statuses) or null */
  status: string | null;
  /** turns left on the status */
  sTurns: number;
  moves: MoveId[];
  /** studio track ST-0: its coat (gameData.coats), or none */
  coat?: string;
  nick: string;
  /** where and when it joined you: a location id (or node), Date.now() */
  met?: { n: DataId | LocationNode; t: number };
  /** when it went into the box (for the 'idle' evolution) */
  boxedAt?: number | null;
  /** battles won (the Hype counter), the lead's win streak, items given away */
  wins?: number;
  streak?: number;
  donated?: number;
  /** the level it last evolved at (no evolving again before the next) */
  evoNo?: number | null;
  /** an Alpha you caught */
  alpha?: boolean;
  /** an Alpha in battle: its HP and stat multipliers (battle.js; not kept after the battle) */
  boss?: { hp: number; st: number };
  /** phase 16: the size of each part (rules.js rollBuild); missing means all M */
  build?: Build;
  /** phase 17: 'robot' for a robot (sp is then made from its parts: logic/fighters.js robotSp); missing for a Billie */
  kind?: 'robot';
  /** phase 17: a robot's gem (a key of robots.json gems): the gem is the robot, its level and XP */
  gem?: string;
  /** phase 17: a robot's parts, one per slot */
  fit?: RobotFit;
  /** phase 17: damage each limb has taken; a limb at or past its HP is broken until healed */
  partDmg?: Partial<Record<'armL' | 'armR' | 'legs', number>>;
}

/** phase 17: a robot part you own (in saveData.parts, or fitted to a robot) */
export interface PartInstance {
  uid: string;
  /** a key of robots.json parts or gems */
  id: string;
  /** upgrade level, 0 to rules.robots.maxUpgrade */
  up: number;
}
export type RobotFit = Record<'torso' | 'armL' | 'armR' | 'legs', PartInstance>;

/** phase 16: a part size per slot (RULES.parts) */
export type PartSize = 'S' | 'M' | 'L';
export type Build = Record<string, PartSize>;

/** a Billie waiting in the grass (game-state.js spawn) */
/** a place's wild Billies: at is the play time (playMs) its stock last grew or was full */
export interface WildStock {
  at: number;
  list: Encounter[];
  /** RL-7: a run's place: the visit it was stocked on (logic/rules.js encountersHere) */
  v?: number;
}

export interface Encounter {
  id: string;
  sp: SpeciesId;
  lvl: number;
  /** studio track ST-0: its coat (gameData.coats), or none */
  coat?: string;
  /** its encounter number (serial) */
  no: number;
  alpha?: boolean;
  /** phase 16: its part sizes, rolled when it appears (rules.js encounterBuild) */
  build?: Build;
}

/** an egg (game-state.js addEgg) */
export interface Egg {
  id: string;
  /** its km, a key of gameData.eggs (a number: hatchEgg compares it with EGG_TIERS) */
  tier: number;
  /** steps toward hatching */
  prog: number;
  /** the incubator slot it is in, or null */
  slot: number | null;
}
