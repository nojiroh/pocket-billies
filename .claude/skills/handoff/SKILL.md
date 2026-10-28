---
name: handoff
description: End a Pocket Billies session - run the checks, write the docs/HANDOFF.md entry (newest on top), update docs/BRANCHES.md and docs/ROADMAP.md, name the tag for the owner, push and open the pull request. Use when a phase or track session's work is done or the owner says to wrap up.
---

# End a session

1. **Checks** (docs/TESTING.md, the tiers): `npm run lint`, `npm run typecheck`, `npm test`, then the before-a-commit
   tier: `npm run check:modules`, `npm run format:check`, `npm run check:data`, `npm run build`. Smoke
   (`npm run check:smoke`, about 3 min) when the session touched game/, tools/check-quick.py, vite.config.js or
   tools/to-module.mjs; the full quick check at the end of a phase. Record what ran, with numbers.
2. **The HANDOFF entry**, at the top of docs/HANDOFF.md, directly above the first `### ` heading (Edit with that
   heading as the anchor; never rewrite the file). The shape the recent entries use:

   ```
   ### <Track> <ID> - <what, in a few words> - <YYYY-MM-DD>
   Branch `<branch>` (<made from / main merged in>). Plan approved in Plan Mode. <scope: what kind of change>.
   Tag `<id>-done` (for the owner to push) on this session's last commit.
   - Changed: <what, with file names; one bullet per area>
   - Found, not changed: <bugs and stale docs met on the way, with file:line>
   - Risky: <what could break, what wasn't measured (phone frame times...)>
   - Verified: <each tier run, with its numbers: unit tests N pass, smoke 6 of 6 in N s, ...>
   - Next: <the next session, on which branch>
   - For the owner on the phone: <what to try, which log to send> (when there's something to test)
   ```
3. **docs/BRANCHES.md**: a row for the branch if it has none (what it holds, the date, where it goes next).
4. **docs/ROADMAP.md**: the session's row marked done, with the date.
5. **The tag**: a session can't push tags (the git proxy refuses them). Name it in the entry (`<id>-done`, or
   `phase-NN-done` for a phase) for the owner, who pushes it or runs the repo-admin workflow's `create-tag`
   (docs/BRANCHES.md).
6. **Push** the branch (`git push -u origin <branch>`) and open the pull request as a draft, then tell the owner, in a
   few lines, what changed, what to try on the phone and what's next.
