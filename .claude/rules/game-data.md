---
paths:
  - "game/data/**"
---

# Game data (game/data)

From CLAUDE.md, docs/NAMING.md and docs/TESTING.md:
- Each data file has a schema in game/data/schema/; `npm run check:data` checks the files, schemas and references
  (the after-edit hook runs it after a data edit).
- game/data/gamedata.js (`window.GAMEDATA=`, about 0.84 MB) is generated from the data files by `npm run data` and
  gitignored: never edit it, and don't open it whole; search it or read the schema.
- Data keys are camelCase; files are named after their section key. Renaming a key, section or value:
  tools/rename-data.mjs, one rename per commit.
- Player-facing words stay unless a phase says otherwise. No data text that could become HTML
  (tools/check-data-text.py runs in CI).
- A data change can break the unit tests on the game's own data (`*-real.test.mjs`): the Stop hook runs the quick
  tier before the reply ends.
