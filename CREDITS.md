# Credits

Pocket Billies is by nojiroh, all rights reserved (see [LICENSE](LICENSE)). These outside parts ship with it or were
used to make it, each under its own licence.

## Fonts

In `game/fonts/`, under the [SIL Open Font License 1.1](https://openfontlicense.org/). The licence texts ship with the
game: [game/fonts/OFL.txt](game/fonts/OFL.txt) and [game/fonts/PIXELIFY-SANS-OFL.txt](game/fonts/PIXELIFY-SANS-OFL.txt).

| Font | Copyright | Source |
|---|---|---|
| Caveat | Copyright 2014 The Caveat Project Authors | https://github.com/googlefonts/caveat |
| Chakra Petch | Copyright 2018 The Chakra Petch Project Authors | https://github.com/m4rc1e/Chakra-Petch |
| Jersey 15 | Copyright 2023 The Soft Type Project Authors | https://github.com/scfried/soft-type-jersey |
| Oxanium | Copyright 2019 The Oxanium Project Authors | https://github.com/sevmeyer/oxanium |
| Pixelify Sans | Copyright 2021 The Pixelify Sans Project Authors | https://github.com/eifetx/Pixelify-Sans |
| Tiny5 | Copyright 2022-2024 The Tiny5 Project Authors | https://github.com/Gissio/font_tiny5 |

## Code

- **[Lit](https://lit.dev) 3.3.3** (lit, lit-html, lit-element, @lit/reactive-element): Copyright (c) 2017 Google
  LLC, [BSD-3-Clause](https://github.com/lit/lit/blob/main/LICENSE). Bundled into `game/vendor/lit.js` by
  `tools/vendor-lit.mjs`.

The build and check tools (Vite, ESLint, Prettier, Ajv, TypeScript, Playwright and the others in `package.json` and
`tools/requirements-check.txt`) are used to make and test the game; they don't ship with it.

## Models

- **[KayKit](https://www.kaylousberg.com) by Kay Lousberg** (Space Base Bits 1.0, Halloween Bits 1.0, Medieval
  Hexagon Pack 1.0): [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Credit isn't required; we give it
  anyway. The source files and their record are in `validation/cc0-src/` (`LICENSES.md`); the game draws the recipes
  made from them (`game/art/scene/next/models/*_cc0.json`).

Everything else (the code, art, data, text, sounds and music) is the game's own.
