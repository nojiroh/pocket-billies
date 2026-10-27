# Pocket Billies (fresh base, version 0.1.0 alpha)

This is a FRESH NEW BASE for the game, not a continuation of the old numbering. The old build (Net Worth v47.x / alpha 0.5) is "legacy": it is kept on a `legacy` branch and tag for reference only. Version numbering starts over at **0.1.0 alpha**. Old saves, old cloud saves, migration code and legacy compatibility do NOT matter and can be deleted.

The game vision is in docs/VISION.md. Read it before any design or art work.

## Ground rules
- Keep the custom WebGL2 renderer. Reuse existing code and art wherever it fits the new design. No engine swap.
- Fixed art commitments: terrain textures and the airship style (low-poly models textured at 32 px/m) are the visual targets. Trainer portraits are 32-bit pixel art. Props that read better flat stay flat on purpose.
- Real-world step tracking is REMOVED. In-game walking with a joystick, the seamless maps and the rooms STAY (docs/VISION.md, How the game plays).
- The game is a roguelite (docs/VISION.md; the plan: docs/phases/roguelite-track.md): a hub, Copperleaf Town, and runs on a node map generated from a seed. Every map outside the hub is legacy: kept for the Studio, not loaded by the game flow.
- One rename per commit. Never mix a rename with a behavior change, so a failed check points at one cause.
- "Renaming" means internal names only (files, functions, variables, data keys, ids). Player-facing words stay unless a phase says otherwise.
- Follow docs/NAMING.md for vocabulary and conventions.
- Do not break: Start-Game, phone mode, the Studio, the in-game full test and the exported debug log. I test on my phone and send you debug logs.
- The version number lives in ONE place and is read everywhere (phase 03). Release numbering and the changelog follow the new scheme.

## Workflow
- Start every session in Plan Mode. Reply with a plan and wait for my approval before editing anything.
- One phase per session. Read docs/ROADMAP.md, docs/VISION.md, docs/HANDOFF.md, then only the phase file I name (docs/phases/).
- The quick check (tools/check-quick.py) drives a headless browser (Python + Playwright, tools/requirements-check.txt); verify the command on first use. Its pictures are compared with the picture baseline as notes, never failures.
- Test speed: the edit hook runs lint, type-check and unit tests for what you edit; run `npm run check:smoke` before a commit that touches game/; run the full quick check at the end of a phase. Tiers and budgets are in docs/TESTING.md.
- Branches follow docs/BRANCHES.md. A plan that takes several sessions lives on one `track/<plan>` branch, named in its plan file's `Branch:` line; every session of it starts on that branch, checks it before any edit and pushes only there. The branch stays after its PRs merge.
- Commit often. When a track or phase plan is finished, its branch gets a `<plan>-done` tag and is deleted (docs/BRANCHES.md); sessions don't ask for per-session tags. Start from the plan's branch with main merged in.
- Anything marked "Ask me before" in a phase file is a decision I want to make myself. Offer options and a recommendation, then wait.
- End each phase by updating docs/HANDOFF.md: what changed, what is risky, what was verified, what is next.

## Treat figures as claims
Numbers and file names in the numbered phase briefs (docs/phases/NN-*, docs/archive/) come from an outside review of the alpha 0.4.1 build (README, file layout, partial code reads), not a full read of the code; track plans quote the code at a dated commit. The current legacy build is alpha 0.5 with a new UI look. Verify each claim against the real code, tell me where it is wrong, and push back on any idea you think is bad.

## Known gotchas (verify)
- The page's modules share names through the generated game/js/hooks.js (tools/to-module.mjs): a new module-level value needs a `setX` setter that calls `provide`, then `npm run modules`; check:modules also checks the load order. Check for name clashes before and after any move.
- Many source lines exceed 300 characters. Reformat only in separate no-op commits.
- gamedata.js is generated (`npm run data`, not in git): one `window.GAMEDATA=` line with every section in game/data/index.json. Read game/data/*.json and game/data/schema/ instead of opening it.
- Debug and self-test code must never send save data, names or step history anywhere.
