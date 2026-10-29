# Pocket Billies: Gotta tax 'em all! — 0.1.0 alpha

A roguelite inside the Hollow Earth with a Pokémon-style world, where the Billies are the wildlife. From the hub,
Copperleaf Town, each run crosses a small region made from a seed. You walk the seamless maps yourself with a joystick
(push it past its rim to run), step into rooms that are bigger on the inside, battle, make friends, and edit everything
in **Pocket Billies Studio**.

0.1.0 alpha is a fresh base: numbering starts over here and old saves don't carry over. What changes from release to
release is in [CHANGELOG.md](CHANGELOG.md); where the game is going is in [docs/VISION.md](docs/VISION.md). The earlier
build (Net Worth, then Pocket Billies alpha 0.1 to 0.5) is kept on the `legacy` branch (its README holds the old
changelog).

## Play

Open **https://nojiroh.github.io/pocket-billies/** in a browser with WebGL 2 (any recent phone or computer). On a
phone, add it to your home screen and it opens like an app and works offline.

Saves stay in that browser. Settings → Export save / Import save moves a save between browsers or devices; signing in
with a Google account keeps it online.

## Sending a debug log

If something looks wrong or runs slowly, open **Settings** (the gear) → **Help** → **Report a problem**:
- **Run the full test**: several minutes on a phone (every place and room, then battles, the map and the opening, then
  a stress test). A table marks each part OK or Problem. Your save isn't changed.
- **Export debug log**: one `.json` file with frame rates per screen and scene, slow frames, errors, loading times,
  your device and graphics chip, and a small picture of the scene. It contains no save data, no names and no positions
  (only which places opened and when).

The **debug menu** (its button there, Ctrl+Shift+D, or `?debug` in the address) has both of those, and:
- **Diagnostics test**: about 6 to 8 minutes on a phone, for when the game runs slowly. It ends with
  **Save the report**, a short `pocket-billies-diagnostics-….json` to send.
- **Graphics cost test**: about 11 to 12 minutes, on a place built for it. It steps every graphics setting through a
  few values and shows what each one costs on your device, costliest first. **Save the report** gives a short
  `pocket-billies-graphics-….json` to send. Your settings and save aren't changed (docs/graphics-bench.md).
- **Graphics test**: every shader, each engine dial on its own and each preset, checking that frames keep coming.

## Run it from the source

You need [Node.js](https://nodejs.org/) 22 or newer.

```sh
npm install        # once: Vite, ESLint, Prettier, Ajv
npm run dev        # the game at http://localhost:5173/game/, the Studio at /studio/
npm run build      # the site in dist/ (game/, studio/ and the start page; each page's modules in one file)
npm run preview    # serve dist/ to try the build
npm run data       # make game/data/gamedata.js from the data files (dev, build and the quick check do it too)
```

Don't open `game/index.html` straight from disk: the game needs a web server. Any static server of the repository
root works too (`python3 -m http.server`, then open `/game/`); run `npm run data` first, or the game reads the data
files one by one (slower). To try it on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the address
it prints.

GitHub Pages is deployed from the build by `.github/workflows/pages.yml` (repository Settings → Pages → Source:
GitHub Actions).

## Pocket Billies Studio

The editor for the game's data, skeletons and art, at **https://nojiroh.github.io/pocket-billies/studio/** (or
`/studio/` on `npm run dev`). Admins sign in with a GitHub token; **Propose changes** opens a pull request with the
changes, and the game changes once it is merged. What each section does is in [docs/STUDIO.md](docs/STUDIO.md).

## Contribute

How the code is laid out, the checks to run before a push and the conventions are in
[CONTRIBUTING.md](CONTRIBUTING.md). Who made the fonts, models and libraries the game uses is in
[CREDITS.md](CREDITS.md).

## Licence

All rights reserved: the repository is public so the game can be played and followed, but its code, art, data and
text are not licensed for reuse ([LICENSE](LICENSE)). Outside parts keep their own licences ([CREDITS.md](CREDITS.md)).

## Project layout

- The root: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CREDITS.md`, `LICENSE`, `CLAUDE.md` (the rules for
  Claude Code sessions), `index.html` (the site's start page), and the configs
  (`package.json`, `vite.config.js`, `eslint.config.js`, `tsconfig*.json`, `.prettierrc.json`, `.editorconfig`,
  `.gitattributes`, `.github/`: the CI workflows and the pull request template).
- `game/`: the game. `index.html` (the script order; the build replaces the module tags with one bundle), `version.js` (the version, the only place it is written),
  `sw.js` (offline cache), `css/`, `fonts/` (SIL Open Font License), `vendor/` (Lit, bundled).
  - `data/`: all game data and rules as JSON files, edited by the Studio (or by hand). `index.json` lists them;
    a file per map (`maps/`), Billie line (`lines/`), trainer (`trainers/`) and person (`people/`), and one file
    per other section (`moves.json`, `rules.json`, `locations.json`, `scenery.json`...). `schema/` has their JSON
    schemas. `gamedata.js` is generated from them (not in git): everything but the maps' ground and props, which the
    game fetches from each map's file when it needs it (`js/map-files.js`).
  - `art/`: pictures, `manifest.js` (atlas rectangles), `next/rigs-next.js` (skeletons).
  - `js/`: the code. `game-data.js` builds everything from the data file; `boot.js` loading; `ui.js` the screens;
    `logic/` the rules that run without a browser (`rules.js` the rules outside battle, `saves.js` the save format,
    `battle-engine.js` the battle rules; they reach the page only through `hooks.js`); `battle.js` the battle screen and HUD; `seamless-world.js` walking from one place into the next; `walk-view.js` the walk scene's data and logic and
    `walk-view-gl.js` draws it (the canvas, mounting a place and the frame; each part of the drawing is a file in
    `walk/`: heights, shaders, ground mesh and textures, the map cache, grass, sky, rooms, water, prop looks, the
    frame's items, sprites, camera, lighting, shadows, fountains and weather, effects, input); `engine/` the 3D engine (settings, WebGL setup, light, post effects); `battle-3d.js`
    battles on the engine; `world-bowl.js` (with `logic/bowl*.js`) the world map; `buildings.js`, `structures.js`, `solid-props.js`, `prop-models.js`
    3D buildings and props; `debug-log.js` the debug log; `self-test.js` the full test; `graphics-test.js` the graphics test and `graphics-bench-test.js` the graphics cost test; `debug-menu.js` the debug menu;
    generated by `tools/to-module.mjs`: `hooks.js` (names from later modules), `debug-log-names.js` (what the debug log
    reads); `test-globals.js` puts the modules' names on `window` for the checks.
- `studio/`: Pocket Billies Studio. It imports the game's renderer modules from `../game/js/`.
- `firebase/`: the Firestore security rules and their tests (`cd firebase && npm ci && npm test`).
- `tools/`: `check-quick.py` (the quick check), `test/` (the unit tests: `*.test.mjs`, with `setup-fixture.mjs` and
  `setup-real.mjs` loading the logic on a small data set or on the game's), `check-data.mjs` and `check-data-text.py`
  (the data checks),
  `build-data.mjs` (makes `gamedata.js`), `to-module.mjs` (the modules' generated imports, `hooks.js` and `debug-log-names.js`), `gamedata.py` (the data for Python tools),
  `check-names.mjs` (the naming rules lint can't check), the renaming tools (`rename.mjs` for code names, prefixes,
  files and properties, `rename-data.mjs` for data keys and sections, `rename-strings.py` for the Python tools'
  strings; each proves a rename changed nothing else), and the Python scripts
  that drew the art and built the maps (the top of each says what it writes).
- `docs/`: vision, roadmap, phases, naming, testing (`TESTING.md`: the tiers and what every phase tests), security
  review, handoff log, the Studio guide, the art rules (`ART.md`).
