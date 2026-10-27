// Phase 04e: the names the classic scripts put on window, for the type check (npm run typecheck). Types only.
// The game's page runs these before its modules, in this order: version.js, js/debug-log.js, js/tap-debug.js, the art
// manifests, data/gamedata.js, js/data-files.js, js/data-fallback.js. The Studio's page has version.js,
// data-files.js, the art manifests and its own inline script, but no debug log and no GAMEDATA.
// A module reads these as plain names (PB_VERSION) or through window / self; both work, a `var` here is on both.
// Keep this file free of top-level import and export: that is what makes its names global (types come in with
// import('./...')). js/debug-log.js is left out of the program (tsconfig.json) because its own top-level const
// debugLog would clash with the declaration here.

/** the game version, '0.1.0 alpha' (version.js, the one place it is written) */
declare var PB_VERSION: string;
/** the same for file and cache names, '0.1.0-alpha' */
declare var PB_VERSION_ID: string;

/** the game data (data/gamedata.js, or js/data-fallback.js from the files); missing only when both failed */
declare var GAMEDATA: import('./game-data').GameData | undefined;
/** how long data-fallback.js took to read the files, ms (only when gamedata.js was missing) */
declare var GAMEDATA_FROM_FILES: number | undefined;
/** the data files' layout and format (js/data-files.js) */
declare var PB_DATA: import('./game-data').DataFiles;

/** the debug log (js/debug-log.js). Only the game's page has it: a module the Studio loads too checks
    typeof debugLog !== 'undefined' first */
declare var debugLog: DebugLog;
/** the version the debug log was started with */
declare var BUILD_VERSION: string;
/** what the debug log reads and wraps in the modules: js/debug-log-names.js fills it in once they have loaded */
declare var GAME: Record<string, any>;
/** Settings → Export debug log */
declare function exportDebugLog(): Promise<void>;

interface DebugLog {
  /** ms since the page started */
  now(): number;
  /** an event: its kind ('data', 'webgl', 'load'...), a message and extra fields */
  add(kind: string, msg: unknown, data?: Record<string, unknown>): void;
  /** an error (the same one twice in a row is counted) */
  error(kind: string, msg: unknown, stack?: unknown): void;
  /** a costly job: what, from when to when (performance.now()) */
  mark(label: string, t0: number, t1: number): void;
  cause(label: string, ms: number): void;
  /** a section's time inside a frame */
  time(section: string, ms: number): void;
  /** the frame scheduler's report of a task it ran */
  task(name: string, work: number, ts: number): void;
  /** LD-0: a step of the boot (or a run's loading) on the timeline, timed since the page was asked for */
  stage(name: string): void;
  /** the loading screen's timings (boot.js) */
  load: { ms: number; files: number; failed: unknown[]; phases: unknown } | null;
  /** the full test's progress and result (self-test.js) */
  bench: { step: string | null; result: unknown } | null;
  /** the scene's picture, taken when the log is exported (LD-1) */
  shot: { t: number; what?: string; jpeg?: string; error?: string } | null;
  /** the rest: the event lists, the samples, summaries, hooks */
  [key: string]: any;
}

/** the art manifests (art/manifest.js, art/rigs.js, art/next/rigs-next.js), made by the art tools and the Studio */
declare var ARTMAN: Record<string, any>;
declare var RIGS: Record<string, any>;
declare var RIGS_NEXT: Record<string, any>;

/** the Studio's page (its inline script): where the game's art is from the Studio */
declare var NW_ARTDIR: string;

/** the checks set it before the page loads: put the modules' names on window (js/test-globals.js) */
declare var PB_TEST_GLOBALS: boolean | undefined;

/** the Firebase SDK, loaded from its CDN by account.js when signing in */
declare var firebase: any;
