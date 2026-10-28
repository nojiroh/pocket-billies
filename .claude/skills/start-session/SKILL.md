---
name: start-session
description: Start a Pocket Billies work session the way the owner wants - check the setup and the branch, read only what the session needs (VISION, the track's ROADMAP rows, the track's newest HANDOFF entries, the named phase file), then plan in Plan Mode. Use at the start of any phase or track session, or when the owner names a session such as "UI-11" or "RL-14c".
---

# Start a session

The owner's rules are in CLAUDE.md; this is the order to apply them in. Don't edit anything until the owner approves
the plan.

1. **Setup.** The first message of a cloud session holds a line from tools/session-start.mjs ("Session setup: ...").
   If it is missing or says FAILED: `npm ci`, `npm run data`, and for the browser checks
   `pip install playwright==<version>` with the version of the global Node playwright
   (`node -p "require('$(npm root -g)/playwright/package.json').version"`).
2. **Branch** (docs/BRANCHES.md, "How a long plan stays on its branch"). Find the plan file's `Branch:` line
   (docs/phases/<plan>.md, near the top) and compare it with `git branch --show-current`. If they differ, say so and
   stop: don't start the plan's work on another branch. If they match, merge main in (`git fetch origin main` then
   `git merge origin/main`, never a rebase) and push.
3. **Read only this**, in order:
   - docs/VISION.md (short).
   - The track's rows of docs/ROADMAP.md: `grep -n "<ID or track>" docs/ROADMAP.md`, then read around the hits.
   - The track's newest entries of docs/HANDOFF.md. Never read the file whole: it is over 14,000 lines.
     `grep -n "^### " docs/HANDOFF.md | grep -i "<track name or ID>" | head -3`, then read from the first hit for
     about 60 lines (Read with offset and limit). Entries are newest first; the top 2-3 entries of any track show
     what else changed lately.
   - The phase or track file the owner named (docs/phases/). Long ones (roguelite-track.md is over 1,300 lines):
     `grep -n "^#" <file>` first, then read the session's part.
4. **Treat figures as claims** (CLAUDE.md): check each number and file name the docs give against the code before
   relying on it, and say where it's wrong.
5. **Plan.** If the session isn't in Plan Mode, enter it. Reply with the plan: context, the changes, what is not in
   it, how it will be verified (docs/TESTING.md tiers), the branch. Anything the phase file marks "Ask me before"
   becomes options with a recommendation. Wait for approval.

While working: the after-edit hook (tools/after-edit.mjs) lints, type-checks and runs the edited area's unit tests;
the Stop hook (tools/before-stop.mjs) runs the whole quick tier before a reply ends when logic, data or tests changed.
At the end, use the handoff skill.
