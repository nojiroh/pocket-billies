# Changelog

Pocket Billies, from the fresh base on. Versions are `0.MINOR.PATCH alpha`: MINOR for a finished phase or a batch of
new features, PATCH for fix-only releases; "alpha" becomes "beta" once the planned features are all in. The version is
written in one place, game/version.js. The legacy build's changelog is in docs/archive/LEGACY-CHANGELOG.md.

## 0.1.0 alpha (unreleased)

The fresh base. Numbering starts over; saves from the legacy build don't load (a new game starts and the old save is
kept aside in the browser).

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
- Fixes: with Motion set to reduced, the camera snaps instead of gliding.
- Under the hood: the game's and the Studio's code are ES modules, and the published game loads them as one file.
  The game needs a web server (opening index.html from disk no longer works at all).
- Under the hood: the modules no longer put their names on `window` (the game and the Studio reach each other's
  code through imports); for the console, add `?globals` to the address.
