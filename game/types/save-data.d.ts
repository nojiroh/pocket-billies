// Phase 04e: the save's format, for the type check (npm run typecheck). Types only: nothing here runs.
// The save is what game-state.js newSave() makes and migrate() fills out and checks, kept as JSON in this browser
// (localStorage) and, when signed in, on the account (account.js stores it as one string). A backup file is
// { game: 'Pocket Billies', format: 1, save } (settings-screen.js exportSave; validSave checks an import).
// Save format 2 (SAVE_VERSION, phase 05): the player's travel along the roads is `trip` (was `route`). A save of
// another format is not loaded; the game says so and keeps it aside.
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
  };
  /** postcards collected (postcards.js) */
  cards?: Record<string, any>;
  /** clothes owned and saved outfits (dressing-room.js) */
  wardrobe?: { owned: Record<string, any>; outfits: any[] };
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
