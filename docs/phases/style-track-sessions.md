# Style track: the prompt for each step's session

The planning session (SY-0, SY-1) starts SY-2 .. SY-8 each in a new cloud session (the owner, 2026-10-27:
"automatically start the next steps in their own Sessions. Their plans are automatically approved"). Each session is
made with source_revision `track/style`, outcome_branch `track/style`, tag `style-track`, and the prompt below with
{STEP}, {WHAT} and {tag} filled in. SY-2 started from `ccr-86dc9cb1-odx2za`, since `track/style` didn't exist yet.

| Step | {WHAT} |
| --- | --- |
| SY-2 | numbers you feel (your HP number rolls down instead of jumping; damage numbers sized by the hit through hitWeight; a KO's number at the largest size), only the battle parts the UI track (UI-16a, UI-16b) does not own |
| SY-3 | the Bureau's mark as data and kit: the emblem (a bean on a lost-property tag, the owner's pick) as SVG in the Studio's icon editor, `bureau.look` in factions.json (schema, types, data check; stamp words RETRIEVED, VOID, DENIED, PENDING, FILED; form numbers), and `pb-stamp` in the gallery in every palette |
| SY-4 | case files: Bureau events open in a manila-folder sheet with the form number, the emblem, typed-in text, redaction bars over flavour words only (costs and outcomes never hidden), and a stamped result |
| SY-5 | the Bureau in battle: stamps on Bureau knockouts, wins and the boss's win line; the Notice of Retrieval inside the join intro's 900 ms (a tap skips it); form-paper ID plates on Bureau bots |
| SY-6 | the coat's foil in the world: a stepped, dithered sheen in the sprite shader (walk-shaders.js) on coated Billies in battle and on the maps, off at quality 2+, under Reduced motion and with Flashes off |
| SY-7 | the Bureau in the world: red tape on bureau_barrier and bureau_crate, the emblem on the checkpoint sign, loose forms blowing past near Bureau places (an ambient-life kind); flat props stay flat |
| SY-8 | tuning and docs: Studio dials (stamp size and slant, the roll's time, the pop sizes, the foil's speed and width), a debug-log line with the Flashes and Animation states that ran (never save data), HANDOFF; the track's end |

## The prompt

````text
Run step {STEP} of the style track in pocket-billies: {WHAT} (docs/phases/style-track.md, section "Sessions").

The owner (nojiroh) pre-approved this step (2026-10-27): "automatically start the next steps in their own Sessions. Their plans are automatically approved." So:
- Follow CLAUDE.md, but don't wait for approval. Read docs/ROADMAP.md, docs/VISION.md, the newest entries of docs/HANDOFF.md (the style track's SY-0 and SY-1 entries and any later SY entries), then docs/phases/style-track.md. Write your plan in your first reply, then build it without waiting.
- Nobody is watching this session. Don't ask questions. At any open choice or "Ask me before" item, take the plan's recommended option (or the safest small one) and list it in your HANDOFF entry under "Decided for the owner, to review". Stop only for something that would break Start-Game, phone mode, the Studio, the in-game full test or the debug log, or that needs a destructive git action. Then write what blocks you into HANDOFF, push, and notify (last step below).
- Treat figures in the track file as claims: verify each against the code and note where it's wrong.

Branch: the track's branch is `track/style` (BRANCHES.md). Push only to the branch your session instructions designate. If that isn't `track/style`, still do the work, push to the designated branch, and say so in HANDOFF and in the notification. First merge `origin/track/style` (if it exists) and then `origin/main` into your branch, with merges, never rebases, and push.

Checks after each change: `npm run lint`, `npm run typecheck`, `npm test`, `npm run check:modules`, `npm run format:check`. If you add an export or a module-level value, run `npm run modules` (CLAUDE.md gotcha). If lines move in files that name art, run `node tools/art-code-refs.mjs` (a unit test compares studio/art-code-refs.json). Then `npm run check:smoke`, and at the end `npm run check:quick`.
Browser checks: `pip install -r tools/requirements-check.txt`. Python Playwright 1.56 expects Chromium build 1194, but the container has 1243 in /opt/pw-browsers. SY-1 made a folder with build-1194 names linked to it:
  P=/tmp/pw-1194; mkdir -p $P/chromium-1194 $P/chromium_headless_shell-1194/chrome-linux
  ln -sfn /opt/pw-browsers/chromium-1243/chrome-linux64 $P/chromium-1194/chrome-linux
  for f in /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/*; do ln -sfn "$f" $P/chromium_headless_shell-1194/chrome-linux/; done
  ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell $P/chromium_headless_shell-1194/chrome-linux/headless_shell
  PLAYWRIGHT_BROWSERS_PATH=$P npm run check:smoke
Never write into /opt.
Known red that isn't yours: on main, CI's smoke fails "The Studio's world map look" (no "Auto (the great oak)" for Copperleaf) and "The Studio's Camera section" (404s on game/art/billionaires/*.png). `run-map-checks.test.mjs` "1,000 maps ... in under a second" is a timing test that sometimes fails on busy CI runners. The full quick check (SY-1, 35 of 41) has known reds that aren't yours: "Terraces ... props in the air: copperleaf: train_station" (also red on main), RL-8 "the town's shop has no Perk", RT-2 "the pair talked but no battle started", "Granny Juniper didn't say anything", "Walking left and right ... room light", and sometimes "Battle music ... the drums never came in on a throw" (passes alone). Re-run a step alone with `python3 tools/check-quick.py --steps=<words>`.

Commit often, one change per commit (never a rename mixed with a behavior change). Message prefix "{STEP}:". Remember the CLAUDE.md gotchas: hooks.js setters, long lines, never open gamedata.js whole, and debug code never sends save data.

Pull request: if an open PR from your branch to main exists, push to it and update its description. If not, open one as a draft. Never merge; merges are the owner's. Keep CI green for anything your change causes.

End of the step:
1. A HANDOFF entry on top (the SY-1 entry's format): what changed, what was found, what's risky, what was verified, "Decided for the owner, to review", what's next. Mark the step done in docs/phases/style-track.md and in ROADMAP. Push. The tag `{tag}` is for the owner, since the git proxy refuses tag pushes; say so in HANDOFF.
2. Notify the orchestrating session: call the claude-code-remote tool `create_trigger` with persistent_session_id "session_019UpAFyAJSkEVjDLuVMFQkS", run_once_at about 2 minutes from now, initiation "human_schedule", name "{STEP} done", and prompt "{STEP} finished: <one line of what was built>; branch <branch> at <short sha>; PR <url>; blockers: <none or what>". If that tool fails, put the same line at the end of your HANDOFF entry; the orchestrator checks hourly.
````
