# Online track (ON) - leaderboards, a Billie showcase, trading and live battles

Branch: track/online

The owner's brief (2026-10-26): expand the friend system with trading, real-time battles, global trading with random
players online, leaderboards for runs, and a place to share Billies that others vote on; research how Pokémon and
similar games did it. Planned in Plan Mode on 2026-10-26 with online research (below) and the owner's answers; the
planning session ran on `ccr-0b8e3c38-gt7t6a` (ON-0). The owner makes `track/online` from main and every later ON
session works there (docs/BRANCHES.md). Tags `on-N-done` (the owner pushes them). Every session starts in Plan Mode,
follows docs/TESTING.md and ends with a HANDOFF entry.

This track absorbs RL-15 (run record, friends' ghosts, daily seeds) and the old phase 18 (friend trading and battles).
It changes the Vision's "Online: ... Nothing else" line (VISION.md updated in ON-0).

Before proposing anything in a session: read the latest HANDOFF.md entries and recent merges, then check the facts
below against main and report what differs.

## Decided (the owner, 2026-10-26)
- **Firebase stays on the free Spark plan.** No Cloud Functions, so no server code: every write comes from a player's
  own game, and `firebase/firestore.rules` is the only guard. What that leaves open is written down per session
  ("Open on Spark") and in docs/SECURITY.md.
- **Order: boards first.** ON-1 base, ON-2 leaderboards (with RL-15), ON-3 Showcase, ON-4 friend trades, ON-5 global
  trading, ON-6 live friend battles, ON-7 random matches. Least risk first; trading waits until the Billie format has
  settled (splicing, augments, RO-3).
- **What can be traded:** ranch Billies, eggs from the nursery, and robot parts. Never a Billie inside a run, never
  items or currencies.
- **Global trading is built on trust** (GTS and Surprise Trade on Spark): the game checks legality and the rules check
  shape and single claims, but a cheater can duplicate or hack. Accepted while the player base is small.
- **Leaderboards are friends only.** No global board until a server exists.
- **Names show as typed** in global views (trainer names and Billie nicknames), with only the existing `cleanName`
  (HTML characters stripped). The block list and report button stay in every global view.
- **PvP rules:** everyone set to level 50 (as official Pokémon play does); splices and abominations allowed. A plain
  ladder can come later if they dominate.
- **Trade evolutions: a few.** 2-3 Billies that evolve when "acquired" (a hostile takeover), each with a single-player
  route too (an item or a Bureau event), so nobody without friends is locked out.
- **No ranked ladder on Spark.** With friends-only boards and no server, a rating could be faked; random matches stay
  casual. Ranked waits for Blaze.

## Verified facts (2026-10-26, main at da51c766)
Every figure is a claim from a read of the code: check it again at the start of each session.
- **Friends** (`game/js/friends.js`, 465 lines): friend codes (`codes/<CODE>`), requests (`requests/<from>_<to>`),
  `users/<uid>` (name, avatar, partner, last place, friend list, code) readable by the owner and the friends on the
  owner's own list; nobody can list `users/` or `codes/`. `cleanFriend` sanitises what is drawn.
- **Rules** (`firebase/firestore.rules`): `saves/<uid>` (owner only, under 1 MB, `t == request.time`), `users`,
  `codes`, `requests`. Tests: `firebase/test/rules.test.mjs` (133 lines) on the emulator, CI job `rules`.
- **Known friends bug** (SECURITY.md "Found, not fixed"): making friends again the other way round after a removal
  drops both sides (`syncFriends` applies an old "removed" after a new "accepted"). Fix: each pair's newest request.
- **No server code anywhere.** The save is one JSON string the game writes (`account.js`; Firebase compat SDK 10.12.5
  from jsdelivr). SECURITY.md's phase 18 table (`offers`, `trades`, `inventory` written by a Cloud Function) assumed
  Blaze: replaced by this track's Spark design.
- **The battle engine runs in plain Node** (tools/test/battle-*.test.mjs, setup-real.mjs) and is seeded: every chance
  goes through `battleRoll()` from `b.rng` (battle-engine.js ~266), so the same seed, teams and choices play the same
  battle. A battle on a copied team (a ghost, a simulation) touches nothing of the save (`battleOnSave`).
- **The field is uneven:** `ACTOR_SIDE = [0, 1, 0, 1, 0]`, `SIDE_ACTORS = [[0, 2, 4], [1, 3]]` (battle-engine.js):
  the player's side has three slots, the foe's two. A mirror PvP match needs a check that both sides can field the
  same count and that turn order doesn't favour side 0 (ON-6).
- **Billies, eggs and parts have ids:** `newUid()` (logic/rules.js:303); robot parts `{uid, id, up}`
  (saves.js ~169); the ranch (logic/ranch-state.js) keeps `pens` (Billie uids), `trainees`, `nursery` (`{a, b, mode,
  at, ready, egg}`), checked by `validRanch`.
- **Not built yet:** `logic/run-record.js`, `daily.js`, the `rival` node's ghost source (RL-15 planned them;
  roguelite-track.md section 3 "Online" and section 4 "RL-15"). RL-S2's `logic/rival.js` exists (Blake's team).

## Research (2026-10-26)
- **Pokémon Scarlet/Violet:** link trades by a shared 8-digit code; Surprise Trade sends one Pokémon to a random
  trainer and you don't know what comes back; the Union Circle groups friends for trades and battles.
- **Pokémon HOME:** the cloud box is where trading happens. GTS: deposit one, name what you want, matched with someone
  whose request fits (1 at a time free). Wonder Box: up to 3 deposits trade in the background while the app is closed;
  Mythicals barred.
- **Pokémon GO:** a flat cost for regular trades, one Special Trade a day, a traded Pokémon can't be traded again
  (stops re-rolling stats), and a traded Pokémon drops to what the receiver's level allows.
- **Main series:** the original trainer (OT) mark; traded Pokémon obey only up to your badges. Fits the kept badges.
- **Pokémon Showdown:** both players choose at once, the server answers each choice request; a turn timer, and a
  `default` choice (the first legal one) when time runs out, as in VGC; undo only while the opponent is still deciding.
- **Slay the Spire / PokeRogue dailies:** the same seed for everyone, only the first attempt counts; PokeRogue resets
  at 00:00 UTC and ranks by waves. The original Slay the Spire boards weren't verified and cheating was a standing
  complaint; Slay the Spire 2's beta made the daily boards friends only, ranked by won, then badges, then speed.
- **Sharing and voting:** Spore's Sporepedia shared creatures with filters and reports; Super Mario Maker 2 shows the
  dangers: courses asking for likes were deleted, early likes snowball, and in 2026 mass reporting (one player on
  several consoles) took down a thousand levels. So: rewards cosmetic, a fresh tab beside the top tab, reports that
  hide only after several distinct accounts.
- **Firebase:** Cloud Functions need the Blaze plan (Spark has none). Spark Firestore's free quota is 50k reads and
  20k writes a day, 1 GiB stored; the Realtime Database allows 100 connections at once on Spark (so live battles use
  Firestore listeners, not RTDB presence).

## What the rules can and can't do on Spark
They can: check shape, size and key whitelists; allow a document to be created only once (a claim); compare a write
with another document in the same batch (`getAfter`, `existsAfter`), so two linked writes succeed or fail together;
count with Firestore's `count()` aggregation (one read per 1000 entries). They can't: read a save's JSON, run the
battle engine, or stop a player from editing their own save. So every swap is "each side moves its own things", and
a cheater can always restore what they gave away. Every session lists what stays open.

## Sessions

### ON-1 Base (1-2 sessions)
- `logic/online-legal.js` (pure): `legalBilly`, `legalEgg`, `legalPart`: species exists, level within the cap, moves
  the line can learn, coat, splice and augment rules (genes.json, augments), stat caps for abominations, part ids and
  upgrade caps. One check used before anything leaves or enters a save. Tests: `online-legal.test.mjs` (every species
  passes, hand-built cheats fail).
- Every Billie, egg and part keeps its `uid`; Billies gain `ot` (the original trainer's uid and name) when first made
  in a save; a traded one gets `traded: {at, from}`.
- Settings: "Online play" (off by default for global views: Showcase browse, GTS, Surprise Trade, random matches);
  friends work as now. A block list (`users/<uid>.blocked`, hidden from others; blocked players never appear in any
  global view and can't send offers). A report button writing `reports/<id>` (create only, reporter's uid, target,
  reason).
- Fix the friend re-add bug (newest request per pair).
- Rules: a helper for create-only claim documents; emulator tests for each new collection as it comes.
- **Ask me before:** the report reasons and what a report does (recommend: hide after reports from 3 distinct
  accounts, the owner reviews in the Studio).

### ON-2 Run record, ghosts, dailies, friends' boards (= RL-15, 2 sessions)
- RL-15 as planned: `logic/run-record.js` `{v, seed, tier, days, result, score, party ≤ 6, relics ≤ 6, path, name,
  hash}` under 8 KB, `validRunRecord`; `ghosts/{uid}` (owner writes, friends read); a friend's last run as a `rival`
  node (RL-S2's node type).
- Daily seed (00:00 UTC, same seed and modifiers for everyone; only the first attempt is posted) and a weekly seed
  with modifiers (modifiers.json).
- Boards: `boards/{board}/entries/{uid}` (create once per board for dailies; best kept for tier boards), read by
  friends through the friend-list pattern. Boards: today's daily, this week's, best per Expedition tier, fastest win.
  Order: won, then score, then fewest days (Slay the Spire 2's order, days for speed).
- The record keeps each run's seed and choices in a shape a server could replay later (if Blaze ever comes).
- Rules: score and days within caps, the board id matching the date, one daily entry.
- Open on Spark: a friend could post a faked score. Friends only, so accepted.

### ON-3 Showcase (1-2 sessions)
- Share a Billie as a snapshot (`showcase/{id}`: species, coat, graft, augments, level, nickname, OT name, theme,
  t): its look only; nothing of value moves. Drawn from data by the game's own art (graft-art.js, the kit bake), so no
  image uploads and no Storage.
- Browse: New, Top this week, Theme, Friends. Pages of 20, cached, to stay inside the read quota.
- Votes: `votes/{entry}_{uid}` create-only (one per account per entry, not your own), counted by `count()`; a vote can
  be taken back (delete own).
- Weekly themes ("best abomination", "most Bureau", a type) from a data file; the top entries' Billies earn a ribbon
  (cosmetic, shown on the Billie and the Trainer card).
- At most 3 entries per player live at once.
- Studio: a moderation view (reports, hide an entry). Hiding needs a moderator: the owner's uid in the rules.
- **Ask me before:** the first themes; whether ribbons show in battle.

### ON-4 Friend trades: Billies, eggs, parts (2 sessions)
- Flow (Pokémon's trade screen): open a trade with a friend, each puts in up to 3 things, a summary both see, both
  confirm, then "Trade!". `offers/{a}_{b}_{t}`: each side writes only its own `give` and `ok`; any change to a `give`
  clears both `ok`s (rules: `diff`).
- The swap without a server: when both `ok`s are set, each game in turn writes one batch: its save without what it
  gave, plus its half-done mark on the offer; it takes what it received only after the other side's mark is there
  (`existsAfter`/`getAfter` in the rules). A game closed midway finishes at next start from the offer document.
- What arrives passes `legalBilly` / `legalEgg` / `legalPart` or is refused (and the offer is closed, nothing taken).
- Traded Billies obey up to your badges (`meta.badges`), as the main series does; a traded one can't be traded again
  for 7 days (Pokémon GO's re-roll guard).
- Trade evolutions: 2-3 lines with an `acquire` evolution (data in the lines), each with a solo route (an item from a
  Bureau event). Tests: the evolution after a trade, and the solo route.
- Trade history on the Trainer card.
- Open on Spark: a cheater can keep a Billie they gave away by restoring their save.
- **Ask me before:** which lines evolve by trade, the item, and the cap per trade.

### ON-5 Global trading on trust: GTS and Surprise Trade (1-2 sessions)
- GTS (`gts/{id}`): deposit one Billie, egg or part (it leaves your save), name what you want (species, level range,
  or "any egg"). Browse by species. Fulfilling: a create-only claim `gts/{id}/claim` with what you give (it leaves
  your save); the depositor's game collects the claim at next start. Taking back an unclaimed deposit returns it.
- Surprise Trade (`surprise/{id}`): deposit; a game that deposits pairs with the oldest open deposit by create-only
  claims on both (one batch); each collects at next start. Never pairs you with a blocked player or yourself.
- Limits: 1 GTS deposit and 3 Surprise deposits at a time; the 7-day re-trade cooldown; legality on deposit and on
  collect.
- Open on Spark: duplication by restoring a save, hacked-but-legal Billies. Accepted (owner, 2026-10-26).

### ON-6 Live battles with friends (2 sessions)
- Invite from the friends list or by a 6-character link code. `matches/{id}`: both teams (level 50 copies, checked by
  `legalBilly`), the seed made from both sides' random halves (each posts a hash first, then the half: neither picks
  the seed alone).
- Each turn: both write their choice as a hash, then reveal (so neither sees the other's move first); undo until the
  other side has revealed. Both games run the same engine on the same seed and choices (lockstep), so animations
  start at once. A mismatch in the end state's hash ends the match as void.
- Turn timer (60 s, a data value) and a default move (the first legal one, Showdown's rule) when it runs out;
  reconnect within 2 minutes or the match is forfeited. Firestore listeners, not the RTDB (100 connections on Spark).
- Before building: check the field (side 0 has three slots, side 1 two) for a fair mirror match, and that a battle
  with two human sides works with `battleOnSave` false for both.
- Tests: a headless match of two clients (tools/), a desync, a timeout, a disconnect.
- **Ask me before:** singles or doubles first (recommend singles, 3 Billies, as Pokémon Showdown's common formats);
  the timer's length.

### ON-7 Random matches (1 session)
- A casual queue (`queue/{uid}`): the oldest waiting player claims a match by a create-only document; the same
  match flow as ON-6. No ladder, no rating (no server). Players with Online play off are never matched.
- Later, with Blaze: a ranked ladder (a Glicko-style rating, seasons), results counted only once a server replays the
  match's choices.

## Testing
- Every new collection: emulator tests in `firebase/test/` (owner writes, friends read, sizes, key whitelists,
  create-only claims, no listing where none is meant), including a cheat suite (a second vote, claiming a claimed
  listing, an offer change after `ok`, a score over the cap).
- Pure logic in `game/js/logic/` with Node tests (legality, records, the trade state machine, the lockstep match).
- The debug log's privacy check (smoke) covers every new screen: no save data, names or step history sent.
- Do not break: Start-Game, phone mode, the Studio, the in-game full test, the exported debug log. Everything online
  stays optional; the game plays the same with Online play off and offline.

## Risks
- Spark's quota: browsing GTS and the Showcase costs reads; pages stay small and cached. A popular day could reach the
  50k reads limit: the debug log notes quota errors and the game says "Online is busy" rather than failing.
- Names as typed in global views (the owner's choice): offensive names reach other players; reports and the block
  list are the answer.
- The Billie format still moving (splicing, augments, RO-3): ON-4 and ON-5 start only when it has settled.
