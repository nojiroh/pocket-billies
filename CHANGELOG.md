# Changelog

Pocket Billies, from the fresh base on. Versions are `0.MINOR.PATCH alpha`: MINOR for a finished phase or a batch of
new features, PATCH for fix-only releases; "alpha" becomes "beta" once the planned features are all in. The version is
written in one place, game/version.js. The legacy build's changelog is in docs/archive/LEGACY-CHANGELOG.md.

## 0.1.0 alpha (unreleased)

The fresh base. Numbering starts over; saves from the legacy build don't load (a new game starts and the old save is
kept aside in the browser).

- Robots (phase 17 prototype): build your own from a gem and four parts (torso with head, left arm, right arm,
  legs). They join the same team and the same battles as Billies. Their moves come from their parts; a hit on a robot
  also lands on a part, aimed moves pick the part, a broken arm loses its move and broken legs are slow; healing and
  the new Repair Kit fix them. A Workshop panel on the Team screen refits them. Placeholder art. In the Studio: a
  Robots section, robot options in Moves, Items and Trainers.
- One version, 0.1.0 alpha, read everywhere from game/version.js: the title screen, the Studio's top bar, the offline
  cache, the debug log, the diagnostics report and saves.
- Friends are safer: friends find each other by code only, only friends see a player's page, and only the receiver
  can accept a friend request. Names lose characters that could break the screen.
- The game needs WebGL 2. Without it, a screen says this device can't run the game, with Try again and Export debug
  log. Lite mode and Settings → Graphics → Battery saver are gone (a save with it on comes back at full effects).
- Real-world step counting is gone: no "Count my steps with motion" and no demo step buttons. Walking with the joystick
  still counts as before until the step-driven parts (money, encounters, eggs) are replaced.
- Removed: the single-file Claude-artifact version, the old train station prop, the v45 backup scenes in the game data
  (1.5 MB), importing a legacy Net Worth backup.
- Smoother towns on phones: props no longer all recheck their height and look in the same frame twice a second, and
  the props' culling grid is no longer rebuilt every 2 s (both were regular hitches in big towns like Clovercrest).
- Diagnostics report format 2: a place's fps counts from once it is open, its opening hitch is reported apart
  (`openHitchMs`, `openHitchCause`), and the first and last second of the other steps are left out (they read low).
  The debug log now names the opening hitch (setting up the ground, building the ground mesh, the walk grid, reading
  the picture back) instead of "outside the marked steps".
- Fix: the full test could let the friends list publish your name and place while the maps loaded at its start.
- Fixes: with Motion set to reduced, the camera snaps instead of gliding. Puffcap Woods and Russetwood get their own
  flower colours (they had the default ones).
- Under the hood: the game's and the Studio's code are ES modules, and the published game loads them as one file.
  The game needs a web server (opening index.html from disk no longer works at all).
- Under the hood: the modules no longer put their names on `window` (the game and the Studio reach each other's
  code through imports); for the console, add `?globals` to the address.
- Under the hood: the code, the data and the files have descriptive names (docs/NAMING.md; the old -> new list is in
  docs/archive/phase-05-renames.md). The places' ids match their names (Marigold Town is `marigold`, no longer
  `sundown`), so a debug log, a `?scene=` link or a Studio export from an earlier build names places the old way.
  The save format is 2: a save from an earlier 0.1.0 build doesn't load (a new game starts and the old save is kept
  aside, as with legacy saves). No text changed, but the 43 places with a new id look a little different: the
  pattern of their ground, their countryside, townsfolk and stamps are picked from the id.
- Under the hood: the rules, the save format and the battle engine are in game/js/logic/, which runs without a
  browser (the page reaches it only through hooks.js; `npm run check:logic` runs it in plain Node). TypeScript checks
  the data, the save and the logic from JSDoc comments (`npm run typecheck`); nothing is compiled.
- Studio: the hidden "With its neighbours" preview button is gone (it hadn't shown since the modules change).
- The debug log's picture of the scene no longer shows what your buddy says (it could name your Billie).
- The full test saves nothing while it runs, in this browser, to your account or to your friends, and puts your save
  back after (a signed-in player's account could get the test's changed save before). Its Road step arrives again
  (it never did since walking became the default), and its room step works on a slow device. Settings → Help says
  what it really covers and that it takes a few minutes.
- Under the hood: unit tests (`npm test`, tools/test/, in plain Node, about a second): the logic on a small data set
  and on the game's own data (battles, double and Alpha battles, catching, the AI, evolution, encounters, saves), the
  world-map graph (places, roads, exits, gates, lifts) and the expressions in dialogue. The quick check runs the
  game's own full test one step at a time, and whole every night (`check-quick.py --selftest`); smoke checks that the
  exported debug log holds no names. A Claude Code hook runs the fast checks after each edit.
