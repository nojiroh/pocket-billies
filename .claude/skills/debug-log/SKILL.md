---
name: debug-log
description: Read a Pocket Billies debug log the owner exported from the phone (pocket-billies-debug-*.json, from Settings -> Help, the debug menu or the full test's results) - summarize it with tools/read-debug-log.py, look at its picture, and trace slow frames, failed full-test steps and errors to the code. Use whenever the owner sends or pastes a debug log, or asks about frame rates, slow frames, errors or full-test results on the phone.
---

# Read a debug log

1. **Never read the JSON whole**: the per-second samples make a log 172 KB after 3 minutes, around 1 MB after a long
   session. A pasted log: write it to `validation/debug-log/<name>.json` (gitignored) first.
2. **Summarize**: `python3 tools/read-debug-log.py <file>`. It prints the build, device and GPU, renderer helpers that
   keep failing (lines with `!`), memory, load, frame rates per screen, slow frames by cause, hitches, the full test's
   steps that weren't ok, errors and warnings grouped, and saves the log's picture; look at that picture.
3. **Read it in this order**:
   - Which phone and GPU, its DPR and the build (`build`, `deploy`): is it the build being discussed?
   - Frame rates per screen: the 10th percentile matters more than the average.
   - Slow frames by cause: the causes are the game's own labels; `grep -rn "<label>" game/js` finds the code.
   - The full test's steps that weren't ok: their `note`, `why` and `ctx` (`debugLog.diag()` at the failure).
   - Errors: the stack's file and line; a deployed build's stacks point into Vite's bundles.
4. **Details on demand** with jq or a few lines of Python, one field at a time: `jq '.more.slowFrames[-10:]'`,
   `jq '[.samples[] | select(.view == "walk")] | length'`, `jq '.bench.result.phases[] | select(.ok | not)'`.
   What the fields mean: game/js/debug-log.js (`build()`, `diag()`) and docs/TESTING.md, "The in-game full test and
   the debug log" (the per-second GPU counters `dc`, `dcp`, `up`, `lit`, `pcl`, `alloc`).
5. **Compare** with the owner's previous log when there is one: frame rates per screen side by side.

Privacy (docs/TESTING.md): a log holds no save, names or step history, by design. Keep logs out of commits, issues
and pull requests, keep them in validation/debug-log/, and never send them anywhere.
