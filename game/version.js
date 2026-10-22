/* Pocket Billies: the game version, the one place it is written. Read by the game (first script in index.html), the
   Studio (../game/version.js), the service worker (importScripts, for its cache name), the debug log, the diagnostics
   report and saves. README.md and CHANGELOG.md can't read it: tools/check-quick.py compares them with it.
   Scheme: 0.MINOR.PATCH alpha. MINOR for a finished phase or a batch of new features, PATCH for fix-only releases;
   "alpha" becomes "beta" once the planned features are all in. Saves have their own format number (SAVE_VERSION). */
self.PB_VERSION = '0.1.0 alpha';
/* the same, for file and cache names: '0.1.0-alpha' */
self.PB_VERSION_ID = self.PB_VERSION.replace(/ /g, '-');
/* the deploy this is ('' here: the built site writes its own, vite.config.js, with the same in build.json; the game
   loads a newer one when the site has it, update-check.js) */
self.PB_BUILD = '';
