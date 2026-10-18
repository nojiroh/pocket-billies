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
  cleaned before it is drawn (`frClean`): only the drawn fields, names without HTML characters, numbers as numbers.
- **Names**: `cleanName()` (game-state.js) strips `< > " & `` ` and control characters where names enter the game: the
  nickname box, `cleanLook()` (the trainer name) and `migrate()` (every load and every imported backup). This makes the
  ~60 places that put `N(m)` or a trainer name into HTML without `esc()` safe as they are. There is no single-quoted
  attribute with a value in it anywhere, so the apostrophe stays (D'Angelo).
- **Game data**: `tools/check-data-text.py` (CI, under a second) fails when any text in the game data (game/data/*.json) has `< > `` ` or a
  name or id has `"`. The game and the Studio put place, Billie, move and scene names into HTML unescaped, and that
  data changes through Studio pull requests too big to read. Nothing in today's data trips it.
- **saveVersion**: every save carries `saveVersion` (game-state.js `SAVE_VERSION = 1`). A save without it (alpha 0.5 and
  earlier) is not loaded: the game says "This save is from an older version of the game and can't be loaded in this
  one", starts fresh, and keeps the old save in this browser under `<save key>-set-aside`. A save from a *newer* version
  is never written over (the game stops saving and asks for a reload). Backups from other versions are refused with the
  same message. An old save on the account is copied to this browser (`-cloud-set-aside`) and is replaced on the
  account once the player plays on (see the open question below).

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

## Studio sign-in (ask before changing; nothing changed)

Why it matters: the Studio and the game share one web origin (`nojiroh.github.io`, like every Pages site of the
account), so anything that runs script on any of those pages can read a token kept in localStorage. The fixes above
close the ways in that we know of; these options shrink what a stolen token can do.

- **A. Fine-grained token for this repository only** (recommended, small). Change the "new token" link to a
  fine-grained token: only `nojiroh/pocket-billies`, Contents and Pull requests read/write, 90 days at most. A stolen
  token then can't touch other repositories. Collaborators make their own the same way.
- **B. Session-only by default** (recommended, tiny). Untick "Remember me" by default, so the token lives in
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
| Text through `esc()` | toasts, battle log lines, postcards, airship captions, account chip, friends list, missing-art list, Studio sign-in | Safe. |
| Player names: nicknames `N(m)` and the trainer name, unescaped in ~60 templates (battle.js, ui.js, game-state.js, buildings, structures, vox, extras, bag) | typed, loaded from a save, imported from a backup file | **Was unsafe** (a backup file could carry a nickname with markup, without any length limit). Fixed at the way in (`cleanName`). |
| Friend data (name, partner, place, request names) | friends list, map pins, world | Already escaped in friends.js and world-map-gl.js; now also cleaned on arrival (`frClean`), and `data-n` gets a number only. |
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
| `saves/<uid>` | owner | owner | the save (unchanged) |
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

## Found, not fixed (not security)

- Making friends again the other way round fails: if A once sent B a request that was later removed, and B then sends
  A a new one that A accepts, both games drop each other again (frSync applies "removed" from the old request after
  "accepted" from the new one). Asking again from the same side works. Fix by taking each pair's newest request (`t`).
  Small; best done with the rest of the friends work (phase 06 or 18).
