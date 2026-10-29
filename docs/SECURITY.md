# Security review (phase 02, 2026-10-16)

What was checked, what changed, what the owner still has to do in the Firebase and Google Cloud consoles, and the
decisions left open. Newest facts win: update this file when the rules, the sign-in or the friend data change.

## The claims from the phase file

| Claim | Verdict |
|---|---|
| The Firestore rules (README) let any signed-in user read all /users and /codes | True, and worse: `allow read` also allows *listing*, so any signed-in player could download every player's name, look, last place (down to the spot they stood on) and friend list, and every code. The rules also let a sender mark their own request `accepted`, so anyone with your code could make themselves your friend. |
| The Firebase web config is committed | True (`game/js/account-config.js`). Normal for Firebase; the key only identifies the project. Whether it is restricted can only be seen in the Google Cloud console (below). |
| The Studio keeps the GitHub token in localStorage when "keep me signed in" is ticked | True. The box is ticked by default, and the token is a classic token with `public_repo`, which can write to *every* public repository of the admin, not just this one. |
| ~57 innerHTML uses in game code | 58 (battle.js 14, ui.js 8, dressing-room.js 5, cutscene.js 4, the rest 1 to 3), plus about 50 in the Studio. Most build HTML in template strings elsewhere, so the count says little: what matters is which outside text reaches them (below). |

## What changed

- **Firestore rules** are in `firebase/firestore.rules` (the only copy; the README points to it) with 13 tests on the
  Firestore emulator (`cd firebase && npm ci && npm test`, also run by CI on every push). Run against the old README
  rules, 8 of the 13 fail, which shows the tests catch what was open.
  - `users/` and `codes/` can't be listed. A code is looked up by its exact value only.
  - `users/<uid>` is readable by its owner and by the players on the owner's own `friends` list. A player can only
    write their own list, so it never opens anyone else's page.
  - A request is created `pending` by its sender; only the receiver can accept or decline; either side can remove it;
    the sender can ask again. `from` and `to` can't change.
  - Writes are checked for shape and size (save under 1 MB, names up to 40 characters, at most 50 friends).
- **friends.js**: a friend's page can only be read once their game has put you on their list too, so a refused read is
  retried every minute instead of showing "Friends need the updated database rules". What a friend's page holds is
  cleaned before it is drawn (`cleanFriend`): only the drawn fields, names without HTML characters, numbers as numbers.
- **Names**: `cleanName()` (game/js/logic/rules.js) strips `< > " & `` ` and control characters where names enter the game: the
  nickname box, `cleanLook()` (the trainer name) and `migrate()` (every load and every imported backup). This makes the
  ~60 places that put `billyName(m)` (rules.js) or a trainer name into HTML without `escapeHtml()` (game-state.js) safe as they are. There is no single-quoted
  attribute with a value in it anywhere, so the apostrophe stays (D'Angelo).
- **Game data**: `tools/check-data-text.py` (CI, under a second) fails when any text in the game data (game/data/*.json) has `< > `` ` or a
  name or id has `"`. The game and the Studio put place, Billie, move and scene names into HTML unescaped, and that
  data changes through Studio pull requests too big to read. Nothing in today's data trips it.
- **saveVersion**: every save carries `saveVersion` (game/js/logic/saves.js `SAVE_VERSION`, 3 since phase 08, 4 since RL-3). A save without it (alpha 0.5 and
  earlier) is not loaded: the game says "This save is from an older version of the game and can't be loaded in this
  one", starts fresh, and keeps the old save in this browser under `<save key>-set-aside` (as `{json, from, at}`, the one shape since RL-1; one slot, holding the latest since RL-3; Settings > Save offers it to download, or to bring back when it can be loaded). A save from a *newer* version
  is never written over (the game stops saving and asks for a reload). Backups from other versions are refused with the
  same message. An old save on the account is copied to this browser (`-cloud-set-aside`, written once and shown nowhere: RL-3
  found it, not fixed) and is replaced on the account once the player plays on (see the open question below).

## For the owner to do (consoles, not code)

1. **Publish the rules**: Firebase console → Firestore Database → Rules → paste `firebase/firestore.rules` → Publish.
   Do this when this branch goes live. The current game mostly works with the new rules too; it only shows the
   "updated rules" warning in the minute before a new friend's game has added you back. Nothing in the stored data has
   to change (existing pages only use the allowed fields).
2. **Restrict the API key** (Google Cloud console → APIs & Services → Credentials → the "Browser key" of
   pocket-billies-121c0):
   - Application restrictions → Websites: `https://nojiroh.github.io/*`, `https://pocket-billies-121c0.firebaseapp.com/*`
     (the Google sign-in page runs there), and for testing at home `http://localhost/*` and `http://127.0.0.1/*`.
   - API restrictions → only Identity Toolkit API, Token Service API and Cloud Firestore API.
   - Firebase → Authentication → Settings → Authorized domains: keep only the ones you use.
   This stops other sites from using the key (and your quota); it does not replace the rules, which are what keep data
   safe.
3. **App Check**: not worth it yet. It proves requests come from your page, not that the player is honest: a signed-in
   player can still call Firestore with their own sign-in, and only the rules stop that. It also needs a reCAPTCHA key,
   debug tokens for the headless checks and local play, and breaks old cached copies when enforced. Worth adding in
   phase 18, when trades make cheating valuable, together with the server code trades need anyway.

## Studio sign-in (A and B done in RL-1, 2026-10-20)

Why it matters: the Studio and the game share one web origin (`nojiroh.github.io`, like every Pages site of the
account), so anything that runs script on any of those pages can read a token kept in localStorage. The fixes above
close the ways in that we know of; these options shrink what a stolen token can do.

- **A. Fine-grained token for this repository only** (done in RL-1: the sign-in links GitHub's fine-grained token page). Change the "new token" link to a
  fine-grained token: only `nojiroh/pocket-billies`, Contents and Pull requests read/write, 90 days at most. A stolen
  token then can't touch other repositories. Collaborators make their own the same way.
- **B. Session-only by default** (done in RL-1: Remember me starts unticked). Untick "Remember me" by default, so the token lives in
  sessionStorage and is gone when the tab closes. Ticking it stays possible.
- **C. GitHub device-flow sign-in** (not now). GitHub's device-flow endpoints don't allow calls from a web page (no
  CORS), so a Pages-only Studio can't use it without a small proxy server (for example a Cloudflare Worker) and a GitHub
  OAuth app. More to run and keep safe than it saves, for a few admins.
- **D. Studio on its own origin** (phase 04, with the Pages deploy question). Serving the Studio from another host
  separates its storage from the game entirely.

## innerHTML review

Every `innerHTML` in game/js and studio/js was traced to where its text comes from. Groups:

| Where the text comes from | Places | Verdict |
|---|---|---|
| Fixed markup, icons, numbers the game computes | most of them (joystick, loader, fishing, story, talk, debug button, battle plates, ticker, pips, map pins) | Safe. |
| Text through `escapeHtml()` | toasts, battle log lines, postcards, airship captions, account chip, friends list, missing-art list, Studio sign-in | Safe. |
| Player names: nicknames `billyName(m)` and the trainer name, unescaped in ~60 templates (battle.js, ui.js, game-state.js, buildings, structures, vox, extras, bag) | typed, loaded from a save, imported from a backup file | **Was unsafe** (a backup file could carry a nickname with markup, without any length limit). Fixed at the way in (`cleanName`). |
| Friend data (name, partner, place, request names) | friends list, map pins, world | Already escaped in friends.js and world-map-gl.js; now also cleaned on arrival (`cleanFriend`), and `data-n` gets a number only. |
| Firebase sign-in name, e-mail, photo URL | account chip, Settings → Save | Escaped. Safe. |
| Game data: place, Billie, move, item, scene and trainer names (game and Studio, unescaped) | gamedata.js from the repo | Trusted source, but changed by Studio pull requests. Guarded by `tools/check-data-text.py` in CI. |
| Studio: GitHub login, error messages | sign-in, top bar | Escaped. Safe. |

Left for phase 06 (one module per screen, safe rendering): render through one helper that escapes by default, so
safety doesn't depend on every source being clean.

## Friend data for phase 18 (trading and battles)

Principle: a player's game only ever writes documents it owns, and anything two players agree on is a document both
can read and each side changes only its own half. Anything that moves value (a Billie, a robot, a part) is never
trusted to a client: it is checked and applied by server code.

| Path | Who reads | Who writes | Holds |
|---|---|---|---|
| `saves/<uid>` | owner | owner | the save: `{ json, savedAt, saveVersion, name, game, t }` only, `t` the server's time of the write (RL-10b) |
| `users/<uid>` | owner, the owner's friends | owner | what friends see (unchanged) |
| `codes/<CODE>` | anyone signed in, by exact code | the code's owner, once | `{ uid }` (unchanged) |
| `requests/<from>_<to>` | the two players | sender: pending/removed; receiver: accepted/declined/removed | the friendship (unchanged) |
| `offers/<id>` (new) | the two players | each side writes only its own `give` and `ok`, while `state` is `open` | a proposed trade: `{ a, b, giveA, giveB, okA, okB, state, t }` |
| `trades/<id>`, `battles/<id>` results (new) | the two players | **server only** (Cloud Function) | what was swapped, the battle result and its seed |
| `inventory/<uid>` (new, phase 18) | owner, the owner's friends (a short list for offers) | **server only** | the tradeable things, so a trade can't be faked by editing a save |

How a trade happens: both set `ok`; a Cloud Function (Firestore trigger) checks both inventories in one transaction,
moves the items, writes `trades/<id>`, and closes the offer. A client can't skip a step, because it can't write
`inventory/` or `trades/` at all. Async battles: each side posts its team to the battle document; the function
simulates the battle from a seed and writes the result. (That needs the battle engine to give the same result for the
same seed and teams, and to run outside the page; not checked yet.)

This needs: the tradeable things to move out of the save into `inventory/` (phase 16-18), a Blaze plan for Cloud
Functions, and App Check at the same time. Nothing in today's rules has to change for it: new collections get their
own rules.

### ON-1 for the owner to do (2026-10-26)
1. Sign in, open Debug > Save, copy "Your account id", and put it in place of `PASTE-YOUR-UID-HERE` in
   `firebase/firestore.rules` (`moderator()`); the rules tests read whatever stands there.
2. Publish the rules (Firebase console > Firestore Database > Rules > paste the file > Publish). Until then blocking
   shows "Friends need the updated database rules" and reporting says "You reported them already." (both are the
   rules' refusal); everything else works as before.

### ON-2 for the owner to do (2026-10-27)
Publish the rules again (they add `ghosts/<uid>`). Until then a finished run's record waits in the browser (it is
posted the next time friends start after the rules are in), the boards stay empty and no ghost waits on a run's map;
everything else works as before.

What ON-2 leaves open (accepted, friends only): `ghosts/<uid>` is written by its owner's game, so a friend could post
a faked entry within the caps (won, up to 40 places, 16 leaders, at least 1 day), or a faked last run (each Billie in
it must pass `legalBilly` when a friend's game reads it, or the ghost isn't used). The rules hold a daily's and
weekly's entry to the server's day or week (or the one before) and never let it change, but a player can still skip
posting a bad attempt (by going offline and clearing the browser before the next start). The record keeps the seed,
challenges, unlocks and path, so a server could replay the map side if Blaze ever comes; battle choices are not kept.

### ON-3 for the owner to do (2026-10-27)
Publish the rules again (they add `showcase/<uid>_<slot>`, `votes/...` and reports on an entry). The moderator line
from ON-1 matters now: hiding an entry and Debug > Moderation work only for the uid pasted into `moderator()`. Until the
rules are published, sharing says "The Showcase isn't open yet" and the Showcase stays empty; everything else works as
before.

What ON-3 leaves open (accepted: everything in the Showcase is cosmetic): an entry is written by its owner's game, so a
modified game can share a look the rules can't see into (the game reads back only looks it can draw: species, coat,
sizes, splice and Augments it has, clean names; anything else is dropped unseen); one person with several accounts
can vote several times (each account once per entry); ribbons are given by the winner's own game from the week's
counts, so a modified game can give itself one. Reports hide an entry after 3 different accounts (as ON-1's names),
so 3 accounts of one person can hide an entry until the moderator shows it again. Votes, entries and reports are
counted with `getAfter`/`existsAfter` in one batch (no `count()`: the compat SDK the game loads has none).

### ON-4 for the owner to do (2026-10-28)
Publish the rules again (they add `offers/<a>_<b>`). Until then Trade opens the sheet but its first write says
"Trading isn't open yet"; everything else works as before.

What ON-4 leaves open (accepted by the owner, 2026-10-26): the rules can't read a save, so a modified game can mark
"gave" and keep the thing, or a player can restore an old save after a trade, and keep both sides (duplication). A
hacked-but-legal Billie passes `legalBilly`. What the rules do hold: only the two friends (friends both ways, not
blocked) read or write their offer; each side writes only its own fields; both oks must be on the same version of both
gives (an ok on an old version is refused), so neither side can swap its give after the other said Ready; nobody
receives before both gave; each mark that changes a save comes with that save in the same batch; nobody can refuse
after the other side received (keeping both); a give with no answer can be closed and taken back after 7 days. What
arrives is checked again by the receiving game (`legalBilly`, `legalEgg`, `legalPart`); a thing that fails stops the
whole trade and each side takes its own back.

### Superseded 2026-10-26: the online track on Spark
The owner chose to stay on the free Spark plan (docs/phases/online-track.md), so the table above (`trades`,
`inventory` written by a Cloud Function) won't be built. Instead every write comes from a player's own game and the
rules guard shape, size, single claims (create-only documents) and linked writes (`getAfter`/`existsAfter`). What
stays open, accepted by the owner: a cheater can keep a Billie, egg or part they traded away by restoring their save
(friend trades, GTS, Surprise Trade); hacked-but-legal Billies pass `legalBilly`; a friend can post a faked score
(boards are friends only for that reason); there is no ranked ladder. Names show as typed in global views (only
`cleanName`); the block list and reports are the answer. App Check is still not worth it (it proves the page, not
the player). If Blaze ever comes, the table above is the plan for trades, boards and ranked matches.

## Found, not fixed (not security)

- (Fixed in ON-1, 2026-10-26: each pair's newest request decides, logic/online.js `friendListFrom`.) Making friends
  again the other way round used to drop both sides.
