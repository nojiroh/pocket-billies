# Phase 01 - Baseline and bug fixes

## Goal
A green, automatically checked baseline and the known bugs fixed.

## Verify first (reviewer claims from alpha 0.4.1; tell me what is wrong)
- camTo is defined twice (scene.js ~167 and ~359) and dioTileHalf twice (diorama.js ~101 and ~154). The later definition silently wins. The first camTo has an extra RM branch.
- The GitHub repo seems to lack tools/ and validation/ (the tests and their screenshot baseline). Is the repo meant to be the deployed copy only?
- No package.json, .gitignore or CI existed in 0.4.1.

## Tasks
1. Run tools/check-quick.py; record which steps pass. This is the safety net for every later phase.
2. Fix the duplicate functions. For each, decide which version is correct and say why.
3. Add a .gitignore.
4. Set up GitHub Actions to run the quick check on every push. On failure, upload the screenshots and results.json as artifacts.
5. Propose how the full project (tools/, validation/, large art or data) should live in the repo; use Git LFS or releases if needed.
6. Propose hooks (formatter, quick check after edits) for Claude Code. Propose only; add them after I approve.

7. Make tools/check-quick.py print the time of every step and the total, and add a `--smoke` subset (a few key steps, about 1-2 minutes) so later phases can check each change quickly. Report the 10 slowest steps. Phase 13 does the deeper speed work.

## Ask me before
Moving large files into Git LFS; changing how the repo is deployed.

## Done when
Quick check passes in CI, duplicates fixed, .gitignore in place, tag `phase-01-done`.

## First reply
(a) Which claims you could and could not confirm, (b) any claim that is wrong, (c) your plan for this phase, (d) questions you need answered.
