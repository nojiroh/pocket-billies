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
- Fixes: with Motion set to reduced, the camera snaps instead of gliding.
