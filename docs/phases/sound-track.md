# Sound track (SND) - a Pokémon-style soundtrack, cries, and a Studio section for them

Branch: track/sound (Part 2, SND-8 on; Part 1 was built on `sound`, before the branch rule; SND-7, Part 2's plan,
was written on `ccr-1e8a9924-tt5x1q` because `track/sound` didn't exist yet)

**Part 2 (SND-7 onward, planned 2026-10-27): layered music and a gentle world** is at the end of this file: music
that mixes the chip sound with DS-era instruments and reacts in layers, environment sounds that never grate, and
water rebuilt. Part 1 (SND-1..SND-6, below) is done.

A track of its own, like the Studio, UI and Terrain tracks (owner's question and the research answer, 2026-10-21;
planned in a chat session, not yet started in the repo). It fixes the sound settings, splits the tracker out of the
game so the Studio can play it, moves the songs into data, and then reworks the music and the sound effects toward
the Game Boy Pokémon sound: written hooks over a generated backing, four voices, the I-bVII progression, battle
intros timed to the throw, and a cry per species. Each session is tagged `snd-N-done`.

## Where it fits in the roguelite track
- SND-1 to SND-3 can run now, beside RL-8. They touch `sound.js`, `settings-screen.js`, the data loader and the
  Studio; nothing in the run's logic or in `ui.js`. SND-3 adds a Studio section the way UI-3a did.
- SND-4 to SND-6 wait for the owner's play test of RL-8, like every RL session after it: the run's beats they score
  (the mast, the payout, a mini-boss, a relic pick, a day passing) exist only from RL-8 and RL-12 on.
- The run gets biome music before the play test: SND-2's where table maps the eleven biomes onto the seven biome
  songs that exist today. It is the biggest audible win for the least code, so it does not wait for SND-4.
- The run's "where it plays" table (SND-2) keys on `nodeTypes.json` (landing, route, town, miniboss, boss), the
  biome and the row, so RL-13's leaders and RL-14's bots get a song by adding a row, not code.

## What the code does today (read at main 1d35666, 2026-10-21; verify)
Everything is synthesized in `game/js/sound.js` (2,013 lines) with the Web Audio API; there are no sound files.

- **The mix.** master (0.9, squared volume) → compressor; buses music (through a low-pass that closes in rain and a
  soft delay), effects, world (placed water, fire, rain, wind, animals) and ambience (birds, crickets, a town's
  murmur, a clock). Volumes live in `saveData.preferences` (music 0.55, sfx 0.8, world 0.5, amb 0.5, master 1, mute).
- **The instruments.** `synthVoice` (pulse 12.5/25/50 % from periodic waves, square, triangle, sine; ADSR, slide,
  vibrato, low-pass, send to the delay), `synthNoise` (one noise buffer through hp/lp/bp filters), `synthKick`.
  That is already a Game Boy palette plus sine.
- **The songs.** 21 recipes in `SONGS` (`sound.js:284`): bpm, key, scale (major, minor, dorian, lydian, mixo), an
  eight-chord progression, lead wave, bass pattern (bounce, gallop, long, walk, drive), arp pattern (up, updown,
  drip, chord7), drum pattern (soft, skip, drive, march, bossa, none), seed, swing, echo. `composeSong`
  (`sound.js:547`) makes the lead by a seeded random walk over the chord tones: bars 1-4 a phrase, 5-6 repeat its
  start, 7-8 a cadence on the home note. `musicTick` plays it 25 ms at a time with a 140 ms lookahead. Every song is
  the same shape: 8 bars of 16 steps, one lead, a bass, an arp, drums, and a sine pad at night. `chord7` stacks four
  sines, so a song can run seven voices at once.
- **Which song.** `musicFor` (`sound.js:808`): hazel before the game starts, wild/trainer/rival in battle, map on
  the map tab, cave or mall indoors, else a location's `music` field, else city, town or route. Only Copperleaf
  sets `music` in `locations.json`; a run's places set none, so a run plays route, town or cave. The seven biome
  songs (innersun, meadow, hills, spore, crystal, trench, spire) are legacy-only and unreachable.
- **Jingles** (`JINGLES`: victory, levelup, evolve, caught, hatch) play on the effects bus and duck the song to
  0.15 for their length. **Cries** hash the species name into one of four waves and a pitch (`sound.js:1053`).
  **Footsteps** by terrain every 1.12 m of gait (`FOOTSTEP_M`, `WALK_SPEED * 0.33`: about 0.35 s apart walking;
  this line said 0.33 m until SND-7) on a 50 ms poller. **One tick** on every button.
- **Settings → Sound** (`settings-screen.js:425`): a mute switch, five sliders with a Test button each.
- **The Studio** loads no sound code. `sound.js` imports walk-view, environment, battle-stage and game-state, so it
  cannot be loaded there as it is. The Studio edits data sections listed in `game/data/index.json` with schemas
  under `game/data/schema/` (`tools/check-data.mjs`), in groups (`studio-app.js:505`).
- **Timers.** The music tick runs on a 25 ms interval with a 140 ms lookahead; the footstep poller every 50 ms and
  `musicSync` every second run for the page's whole life, on the title screen and with no song. Fine while visible,
  wasteful on a phone (a claim: measure in the debug log before and after).
- **Tests.** No unit test touches sound. The quick check only asserts that at least nine world beds started.

### Bugs found (SND-1 fixes them)
1. The Music **Test** button plays the level-up jingle, which plays on the effects bus: with music up and effects
   at 0 it is silent (`sound.js:849`). By the same routing, music at 0 still plays every victory tune (kept in
   SND-1: the owner chose to leave jingles on Sound effects).
2. The master **Test** button plays nothing: `testVolume` has no master branch (`sound.js:1924`).
3. Master and Ambience do not apply while dragging; the live listener covers music, sfx and world only
   (`sound.js:1165`).
4. `i18n.js` translates Music, Sound effects and World sounds, not Volume, Ambience, Test, the mute row or the hints.
5. (Claim, check on the phone.) The unlock handler resumes the context only from `suspended` (`sound.js:165`); after
   a call or Siri, Safari reports `interrupted`, and `music()` refuses to start while the state is not `running`.

## The research, in short (sources in the chat answer of 2026-10-21)
- Red and Blue were written by one person on the Game Boy's four voices: two pulse, one wave, one noise. Pallet Town
  is two voices, a melody and a countermelody; the adventure tracks use all four, with noise as a marching snare.
- The series' signature progression is I-bVII-I (a major key with the flattened seventh: mixolydian). Battle themes
  open with chromatic runs; counterpoint implies the harmony the hardware cannot play.
- Battle music was timed to the throw: a falling sound before the battle, the song held until the ball flies.
- Early routes are simple and welcoming, late routes triumphant; towns reuse route motifs (leitmotifs); night
  versions are slower and lower. Black and White swapped the low-HP beep for a tense variant of the battle song.
- Gen 1 built 151 cries from about 37 base cries, each species a base plus a pitch and a length setting.

## Sessions
| # | Session | Goal | Depends on | Sessions | Verified by |
| --- | --- | --- | --- | --- | --- |
| SND-1 (done 2026-10-22) | Settings and routing | the five bugs above, the Music Test on the music bus, a one-tap mute beside the sheet's title, the Sound tab translated | none | 1 | unit test for the levels; the quick check's Sound settings step; phone |
| SND-2 (done 2026-10-22) | The tracker as data | `game/js/audio/tracker.js` with no game imports; `music.json` + schema (songs, jingles, cries, where); biome music in a run; timers that stop when idle; a song fingerprint baseline | SND-1 | 1-2 | fingerprints unchanged; check-data; modules check; the run fixture plays a biome song |
| SND-3 (done 2026-10-22) | The Studio's Music & sound section | play and loop any song, the recipe's dials, a piano roll for the hook, the where table, a cry card on Billies, check warnings | SND-2 | 1-2 | Studio self-test; quick check; the owner plays it |
| SND-4 (done 2026-10-22) | The Pokémon rework: themes | four voices, written hooks and countermelodies, the title motif as a leitmotif, Copperleaf as two voices, night variants | SND-3, RL-8 played | 1-2 | fingerprints updated on purpose; the owner listens on the phone |
| SND-5 (done 2026-10-22) | Battle and run music | intros timed to the throw, wild/trainer/leader/boss/rival/ghost, biome × row variants, the deadline variant (gone with the deadline in RL-R2), the red zone | SND-4, RL-8 | 1-2 | battle fixture; run fixture; phone |
| SND-6 (done 2026-10-23) | Sound effects and jingles | a cry per species with a low-HP cry, four UI sounds, jingles for the run's beats, a mix pass | SND-4, RL-12 for relics | 1 | battle golden record untouched; phone |

Budget: SND-1 to SND-3 are three to five sessions before the play test; SND-4 to SND-6 three to five after. Tiers
and time budgets follow docs/phases/13: lint, type-check and unit tests after each change, the smoke subset after
each commit, the full quick check at the end of a session.

## SND-1: settings and routing (done 2026-10-22, branch `sound`, tag `snd-1-done` local)
The owner's answers at the start: **jingles stay on Sound effects** (no new slider), **volumes stay in the save**
(they follow the account, and reset with the save), **the mute goes in the settings sheet's header**. What was built,
one cause per commit:
1. `game/js/audio/levels.js` (pure): `soundLevel` and `soundLevels`, the five bus gains from the preferences.
   `applyVolumes` and `applyAmbienceVolume` use it; `tools/test/sound-levels.test.mjs` tests it. No change in sound.
2. The Volume (master) Test button plays a two-note chime on the master bus (it played nothing).
3. The Music Test button plays on the music bus: `jingle()` takes an optional bus (the effects bus by default, so
   every jingle in the game is where it was).
4. Volume and Ambience apply while dragging (`LIVE_VOLUMES`, all five).
5. Any touch resumes audio from any state but running or closed (iOS's `interrupted`; to confirm on the phone).
6. A mute button beside the sheet's title (`game/art/ui/sound.svg`, `sound-off.svg`): first in the sheet's body in a
   box of no height (`.set-top`), lifted into the title's row by menus.css, because ui.js draws the title and stays
   closed until UI-5. A first try put it at the end of the tab strip: at 390 px that cut the Help tab off.
7. The tab's words: Sound effects names the short tunes; the "0 mutes" note went; the Volume slider is announced
   "Volume", not "Volume volume".
8. Translations for every Sound-tab string and the button's labels (nl, de, es, fr).
9. Quick check: the "Sound settings" step (full check). It failed on the code before 2-4, as it should.

Corrections to this file's plan, found in SND-1:
- The `musicFor` test moved to SND-2 (item 4 below): sound.js imports the walk view, renderer and battle stage, so it
  can't load in plain Node; `songFor` will be pure.
- The debug log already exports every preference (debug-log.js `preferences`), so the volumes and mute were already
  in it; nothing added.
- Moving preferences out of the save (planned step 5) was declined by the owner.

## SND-2: the tracker as data
Two halves, the first all renames and moves (no-op commits), the second new data with the old values in it.

1. **The split.** `game/js/audio/tracker.js`: the instruments, `composeSong`, the playback tick, the delay and the
   waves, taking an `AudioContext` and a destination at `create(ctx, bus)`; no import outside `util.js`. `sound.js`
   keeps the mix, `musicFor`, the footsteps, the battle sounds, the world and ambience beds. `logic/` is not the
   place (NAMING.md: nothing that plays sound), hence `audio/`. `npm run modules` after each move; check:modules.
2. **A fingerprint baseline.** Before the first move, a Playwright step renders 8 bars of every song and every
   jingle through an `OfflineAudioContext` (the same sample rate every run) and writes the RMS of each 50 ms window
   to `validation/sound-baseline/<song>.json`. Each later commit in the session compares against it with a small
   tolerance. A refactor that changes a fingerprint is a bug; SND-4 and SND-5 regenerate it on purpose, like the
   picture baseline.
3. **`music.json`** (listed in `index.json`, `music.schema.json`): `songs` (today's recipe fields, plus optional
   `hook` and `counter` as note lists of `[step, midi, length]`, an optional `intro` of bars, `night` overrides),
   `jingles` (note lists, bpm, wave), `cries` (`bases`: the base recipes; a species names `base`, `pitch` and
   `length` in `roster.json`, like Gen 1), and `where`: an ordered list of rules `{battle, nodeType, biome, row,
   indoor, tab, song}`, first match wins, with today's choices written out so nothing changes.
4. **`logic/music-where.js`** (with the `musicFor` test SND-1 left for here): `songFor(state)` reads the where table from a small state object (started, battle
   kind, tab, node type, biome, row, indoor, location music). Pure, tested in `sound.test.mjs`; `musicFor` builds
   the state and calls it.
5. **Biome music in a run.** Where-rules by biome, mapping today's eleven biomes onto the seven biome songs
   (meadow → meadow, thicket and jungle → spore, lake and sea → trench, canyon and badlands → hills, volcano →
   innersun, tundra and ridge → crystal, autumn → spire), and a town node onto `town`, the landing onto `route`.
   The first audible change of the track, in its own commit, after the fingerprint baseline. SND-4 refines the
   mapping with its two new songs. **Ask me before:** the mapping (the names above are a first guess from the
   recipes' moods; you may want to hear each pair in the Studio first, which is SND-3).
6. **Timers that stop when idle.** The music tick's interval starts with a song and clears when none plays; the
   footstep poller starts with the walk view and clears on the title screen and in battle; `musicSync` runs from
   the places that change what plays (tab change, battle start and end, a scene arrival, a cutscene end) with a
   slow fallback every few seconds instead of every second. Moving the tick onto the frame loop waits for UI-5's
   `ui.js` split; the fingerprints and the debug log's timer count say whether this changed anything.
7. `check-data` validates `music.json`; the quick check's `unused` list names songs no where-rule and no script
   uses (the Studio's story scripts play songs by name: `music rival`).

### SND-2 as built (2026-10-22, branch `sound`, tag `snd-2-done` local)
The owner's answer at the start: **the mapping as written in item 5**. One cause per commit:
1. `tools/check-sound.py` and `validation/sound-baseline/` (23 files, 71 fingerprints: 21 songs by day and at night,
   5 jingles, 24 cries) before anything moved; the full check's "Song fingerprints" step runs it. It drives the
   game's own `initSound` with a stand-in `AudioContext` that hands it an `OfflineAudioContext`, seeds `Math.random`
   and holds the clock still while one tick schedules 8 bars. Every later commit: none changed.
2. `game/js/audio/tracker.js`, in three moves: the instruments (`trackerCreate(ctx, bus, { songs, levels })`: echo,
   noise, pulse waves, `synthVoice`, `synthNoise`, `synthKick`), the composer (`trackerCompose(recipe)`, pure, returns
   a new object: it no longer writes notes into the recipe), the player (`play`, `stop`, `tick`, `jingle`). It imports
   nothing; `levels()` is sound.js's say on the drums and the night pad. sound.js keeps its exported names.
3. `music.json` + `music.schema.json` (songs, jingles `{notes}`, `cries.bases` (the four waves), `where`), then sound.js
   reading it. check-data: songs a rule or place names exist, node types and biomes exist, the last rule always
   matches.
4. `logic/music-where.js` `songFor`; `musicFor` builds the state; `tools/test/sound.test.mjs`. In a browser the old and
   new `musicFor` agree on every place of the town fixture.
5. Biome music: after a place's own song, a town node town, the landing route, then the eleven biome rules. The full
   check's "Run music" step on the run fixture (it fails on the code before the rules).
6. Timers: the tracker's 25 ms timer stops with no song and while the page is hidden; the footstep poller skips its
   terrain work while no sound can play.
7. The Unused report names songs nothing plays (none today).

Corrections to this file's plan, found in SND-2:
- `variants` is not unreachable: three parked places (legacy/locations.json) name it. Nothing in the run does.
- The drums' noise is random (`Math.random`, the buffer and each hit's offset): fingerprints need it seeded.
- `composeSong` wrote its notes into `SONGS`; data read from music.json must not be changed in place (a Studio save
  would write the notes back), so the composer returns a new object.
- The debug log has no timer count (item 6's "the debug log's timer count"): nothing measured it before or after.
- `musicSync` stays on its 1 s interval (item 6 planned calls from the tab change, battles, arrivals and cutscenes
  with a slower fallback): those are in ui.js, the battle and the cutscenes, which this track keeps out of, and a
  sync that finds the same song does no audio work. The footstep poller already did nothing on the title, in battle
  and hidden, so it was not moved onto the walk view either.
- Only five biomes reach a run today (rules.json `run.map.biomes`: meadow, lake, thicket, ridge, autumn); the other
  six rules wait for the biomes.
- Cries: the four bases hold only their wave; the shape (pitch from the name's hash, the slide, the second note) is
  still code, for SND-6.

## SND-3: the Studio's Music & sound section
A section `music` in the Game group (**ask me before:** its own group "Sound" instead), built like the UI section:
1. **Song list** with play, stop and loop, through the shared tracker on the Studio's own `AudioContext` (a button
   press unlocks it). The list shows where each song plays (from the where table) and flags songs nothing names.
2. **Recipe card**: tempo, key, scale, the eight chords as roman numerals (I, ii, iii, IV, V, vi, viiº, with bVII
   under mixolydian), lead, bass, arp, drums, swing, echo, seed; every change re-composes and keeps playing.
3. **Hook roll**: a 32-step piano roll (two bars) for the hook and the countermelody over the first two chords,
   drawn on the shared pixel canvas's grid code if it fits, else its own small canvas; notes snap to the scale.
4. **Where table**: the rules as rows with selects for each key, drag to reorder, a "play what this picks" button.
5. **Cry card** on the Billies section: base, pitch, length, play; a low-HP preview.
6. **Jingle editor**: the same roll, one bar, with a play button.
7. Save through the existing Save to game flow; `check.js` warns on a song with no where-rule, a species with no
   cry, and a where-rule that names no song.
8. Verified by: the Studio self-test opens the section, plays a song for a second and checks the context is
   running; the quick check's Studio step; the owner tries it.

### SND-3 as built (2026-10-22, branch `sound`, tag `snd-3-done` local)
The owner's answers at the start: **a Sound group of its own**; **the tracker plays a hook and a counter now** (not
from SND-4); **a cry per stage in lines/*.json, read by the game**. One cause per commit:
1. `tracker.refresh(songs)`: compose again after an edit; the song playing keeps its place (the cache and the table it
   was made with hid every edit). The game never calls it.
2. `logic/music-studio.js`: `chordNumeral`, `musicNoteName`, `musicRuleText`, `musicSongUses` (`MUSIC_CODE_SONGS`:
   title and fall, which code starts by name; a test holds the list to the code), `musicFindings` (check-data's
   errors now come from it), `MUSIC_CHOICES` (held to the schema's enums), `musicJingleNotes` / `musicJingleList`.
3. The section (`studio/js/music-editor.js`, group Sound): the song list and player on the Studio's own
   AudioContext, made on the first ▶; it stops by itself off screen (the tracker's tick checks).
4. music.json's note is `about`, not `_help` (a rename: the Studio drops `_` keys from undo and saves).
5. The recipe card; 6. the where table (one line per rule with only its conditions, ↑ ↓, Try a place);
7. the tracker plays `hook` (bars 1-2 and 5-6) and `counter` (a quieter 12.5 % pulse); 8. the hook roll (its own
   canvas); 9. the jingle editor (the same roll).
10. Song fingerprints: the cries are the species' (by id, as the game asks); `cries.json` written again, nothing
    else. Then `logic/cries.js` (`cryRecipe`, `cryVoices`, `cryLowHealth`), `cry` per stage in line.schema.json,
    SPECIES[id].cry, sound.js plays it; the Cry card on the Billies page.
11. The Studio's Check: music-editor.js `musicCheckFindings`, Show me; the cries as one note.
12. The self-test's `music` row; `check-studio-github.py --only=music`.
Fingerprints after every commit that touched the tracker, sound.js or the data: 71, none changed (a cry set on
bezos0 changes its fingerprint alone: seen).

Corrections to this section's plan, found in SND-3:
- `hook` and `counter` were in the schema but nothing played them; the roll would have edited silence until SND-4.
- roster.json is the art-progress board, not the species: cries live per stage in `lines/*.json`, beside names and
  types. No species had a cry; a "species with no cry" warning would have fired 24 times, so it is one note.
- Jingles are 6 to 22 sixteenths, not one bar: the roll is as long as the jingle plus a bar.
- Drag to reorder became ↑ ↓ buttons (keyboard, and HTML drag needs more code for little); the pixel canvas is RGBA
  art with art undo, so the roll is its own canvas.
- The quick check's Studio step only proves every script loads; the section's own check is in
  `tools/check-studio-github.py` (`--only=music`).
- The SND-2 cry fingerprints were of roster names (cartotter), which the game never plays; now species ids.
- The Studio is for a computer, not a phone (the owner): no phone layout work.

## SND-4: the Pokémon rework, themes
Audible changes, fingerprints regenerated at the end on purpose.
1. **Four voices.** A song declares its voices: two pulse (lead and counter or arp), one triangle (bass), one noise
   (drums). `chord7` becomes a two-note arp; the night pad becomes a single triangle line; the echo stays as the
   game's own colour. An "extra" flag keeps the thicker mix for the title and the fall only.
2. **Written hooks.** The composer takes a song's `hook` as bars 1-2 and makes bars 3-4 answer it (same rhythm,
   steps toward the next chord tone), bars 5-6 repeat the hook, 7-8 cadence. A `counter` plays under the hook on
   the second pulse. **Ask me before:** who writes the hooks (recommendation: I draft them as note lists, you
   keep or change them in the Studio's roll).
3. **The motif.** One mixolydian theme (I-bVII-I) for the title; its first bar returns in Copperleaf's song (as the
   countermelody), on the airship mast and in the payout jingle.
4. **Copperleaf** as Pallet Town: two voices, no drums, slow swing, the music-box lead (p12, short decay).
5. **Night** versions by data: a `night` override per song (slower by 6-10 bpm, the key a fourth down, drums
   soft), picked by `environmentHour`, crossfaded at dusk and dawn as songs crossfade today.
6. **Biome songs.** Two new ones (a volcano march, a tundra waltz) and the SND-2 mapping revised so that no two of
   the eleven biomes share a song unless they should.

### SND-4 as built (2026-10-22, branch `sound`, tag `snd-4-done` local)
Started before the owner's word on the RL-8 play test, on purpose (the owner). Main's ROADMAP already had RL-8 "done,
played"; nothing in SND-4 needed RL-8 but its code (the mast's take-off and the payout), which was only on main, so
`sound` merged main first. The owner's answers at the start: **placeholder hooks the owner edits, clearly named as
placeholders**; **the motif on the hub and the run's bookends** (title, Copperleaf, the take-off, the payout);
**merge main first**; **item 6 (two new biome songs) deferred**. One cause per commit:
1. Merge main (RL-8, RL-9, RL-11, RL-12a, the island track). Fingerprints unchanged.
2. `check-sound.py` renders the night as the game will play it (`musicVariant`), as long as the night recipe. Tool only.
3. **Four voices** (tracker.js): pulse lead; a second pulse for the counter in its bars, else the arp (chord7 a
   two-note 12.5 % arp, drip a 12.5 % pluck); triangle bass (drive off the 50 % pulse); noise drums with the kick. A
   triangle lead keeps the triangle and the bass moves to the second pulse. The night pad only in `extra` songs (the
   title, the fall). **The composer answers a hook**: bars 3-4 keep its rhythm, each note on the nearest tone of the
   new chord (ties go down); the counter too. New recipe keys `extra`, `pluck` (a music-box lead) and `none` for bass
   and arp.
4. **Night versions**: a song's `night` changes, or by default 8 bpm slower, a fourth down, soft drums, the hook and
   counter moved with the key (`trackerNight`, played as `town@night`). `logic/music-where.js` `songVariant` picks it
   outdoors and out of battle, night from 0.6 and day again below 0.4. `night: false` on the battle songs, cave, mall,
   hazel, the title and the fall. The Studio's player has a Night switch. A later fix: the first touch works out the
   night before the first note.
5. **Names**: `hookName` per song and `name` per jingle; the Studio edits them and its Check lists everything still
   named "placeholder…".
6. **The motif**: the title in D mixolydian (I bVII IV I | I bVII IV bVII) with a written hook; a `motif` jingle (its
   first bar, home on D).
7. **Copperleaf**: music-box lead (p12, pluck), no bass, arp or drums, 88 bpm, swing 0.18; the motif an octave down
   as its countermelody.
8. Placeholder hooks for town (with a counter), route, map, hazel, cave, meadow, trench, spore, crystal, spire.
9. The motif plays as the airship takes off for a run (`runTakeOff`) and once on the payout screen.
10. The fingerprint baseline written again, in its own commit (72: the motif jingle added), after checking every
    commit against the one before it.

Corrections to this section's plan, found in SND-4:
- Item 6 deferred: only meadow, lake, thicket, ridge and autumn reach a run (rules.json `run.map.biomes`), and they
  already play five different songs; a volcano march and a tundra waltz would be heard by nobody.
- Item 1's "the night pad becomes a single triangle line": the triangle is the bass, so a fifth line breaks the four
  voices. The pad is gone from four-voice songs; the night version is the night's colour.
- Item 1's voices didn't match the code: drive bass was a 50 % pulse, drip and chord7 sines, six songs had their lead
  on the triangle (hence the rule above).
- Item 3's "on the airship mast" is the run's take-off from the mast (`runTakeOff`), not every town-to-town flight.
- Item 5's "picked by environmentHour" is the environment's night level (`environmentState`, as updateAmbience reads
  it), which already follows the hour, with dusk in between.
- Item 5's per-song night overrides (tuned by ear): none written. Claude can't listen; every outdoor song uses the
  default night until the owner writes one in the Studio.

## SND-5: battle and run music
1. **Intros.** A song's `intro` is one or two bars (the chromatic run on the lead, drums out) that play once. The
   encounter sting starts the intro on the flash; the drums enter on the throw (`battleSoundEffect('enter')`), as
   Masuda timed it.
2. **Battle songs** by kind through the where table: wild, trainer, rival, leader (mini-boss), boss, ghost (a
   friend's run, RL-15). The leader song reuses the title motif in minor.
3. **The red zone.** When the player's lead Billy is under a quarter of its HP, the song switches to its `tense`
   variant (faster, bVII pedal, march drums), back when healed. **Ask me before:** this (Black and White) or the
   classic beep (recommendation: the variant; the beep as an accessibility switch off by default).
4. **The run arc.** A where-rule can name a `row` band: rows 1-3 play the biome song as written, rows 4-6 with
   `drums: march` and the arp up an octave, rows 7-9 with the counter on; the last day before the deadline plays a
   `deadline` variant (drums only, the hook on triangle). The `map` song gets the forecast's weather as a low-pass.
5. Verified by: the battle fixture's log shows the intro, throw and drum entry at the right ticks; the run fixture
   plays each row band; the owner listens on the phone.

### SND-5 as built (2026-10-22, branch `sound`, tag `snd-5-done` local)
The owner said "Start" to the plan without picking options, so the recommended answers were taken: **the tense
variant, with the classic beep as a switch off by default**; **the deadline version on the deadline day alone (and
every day past it)**; **no ghost song until RL-15**; **the weather filter in**. One cause per commit:
1. `check-sound.py` renders a song's intro and the variants sound.js `musicParts` names. Tool only.
2. The tracker: a song's `intro` (one or two bars, the lead alone) played once when asked (`{ intro }`); `{ hold }`
   keeps the drums out until `drumsIn()` or 8 s; `trackerRecipe` reads a name with parts ('town@night').
3. Battle kinds: `musicBattleKind` (a run's mini-boss is `leader`, its boss `boss`); two where-rules sent both to
   trainer first, so nothing changed yet.
4. Timed to the throw: `battleSoundEffect` 'wild' and 'trainerIn' start the battle's song with its intro and the
   drums held; the first 'enter' lets them in. The music sync waits up to 2.5 s for a battle's flash. `soundEngine.log`
   keeps the cues for the checks.
5. The battle songs: hooks and intros for wild, trainer and rival; a `leader` song (the title's motif in D minor) and
   a `boss` song; all placeholders.
6. The red zone: `trackerTense` (16 bpm faster, march drums, a new `pedal` bass on the flat seventh) while the lead
   Billie (the player's first standing) is under a quarter (`RED_ZONE`, `musicRedZone`); a song taking over a held one
   keeps the hold.
7. Settings → Sound: a Low HP beep switch (`lowHpBeep`, off), translated.
8. The run's arc: music.json `run.arc`, rows 3-5 `mid` (march, the arp an octave up) and 6-8 `late` (plus a counter
   made from the hook, `counterAuto`); `musicArcBand`; at night 'meadow@late@night'. A song's `arc: false` opts out.
9. The deadline version: `run.deadlineDays` 1; the drums and the hook on the triangle alone (`trackerDeadline`), over
   the band and the night; not on the map tab or in battle.
10. The map song hears the forecast: `run.weather` (storm 1400 Hz ... ash 2400), `musicWeatherCut`, on the map tab.
11. Fix: a new battle with the song already playing restarts it (`restart`); found by the Battle music step.
12. The full check's Battle music step; the Studio's music check reads the rules' places from the table (the new
    rules had moved them).
13. The Studio: an Intro roll, a Version pick (tense, deadline, a band), an In a run card.
14. The fingerprint baseline written again (109), in its own commit.

Corrections to this section's plan, found in SND-5:
- Item 2's ghost (a friend's run) has no battle to play in before RL-15: no song, no rule. `MUSIC_BATTLE_KINDS`
  gets it then.
- Item 4's "rows 1-3, 4-6, 7-9" count from 1; the map's rows count from 0 (the landing), so the bands are 0-2 (as
  written), 3-5 and 6-8, and each starts on a mini-boss's row. "With the counter on": the biome songs have no
  written counter, so the late band makes one from the hook.
- Item 4's "a where-rule can name a row band": rules could already match `row` (SND-2); the arc is a version of the
  same song, not another song, so it is `run.arc`, not a where-rule.
- Item 4's "the `map` song gets the forecast's weather as a low-pass": the music already had a low-pass that closes in
  the place's own rain (v27); on the map tab it now follows today's forecast where you stand instead.
- Item 1's "the battle fixture's log": there was none; `soundEngine.log` is new, in memory, read by the full check.
- In a run a battle can begin again at once from its seed ("The battle starts again."), asking for the song already
  playing: hence `restart`.

## SND-6: sound effects and jingles
1. **Cries.** About eight base cries by kind (beast, bird, slime, machine, fish, insect, ghost, suit) in
   `music.json`; each of the 24 Billies sets base, pitch and length per stage in `lines/*.json` `cry` (from SND-3); the Studio card from SND-3
   edits them. A low-HP cry is the same cry faster and a third down. A robot's cry comes from its torso part.
2. **UI sounds.** Four instead of one: select (the tick), confirm (a rising fifth), cancel (a falling one), can't
   (a dull buzz); the click listener picks by `data-a` and the button's class, so no screen changes.
3. **Jingles for the run's beats.** relic picked, node revealed, a day passing (the clock's tock, twice), run won
   (the victory tune plus the motif), run lost (the victory tune's notes backwards in minor), payout counting (a
   coin per step, pitch rising). Each is a note list in `music.json`.
4. **The mix pass.** The ambience and world beds come down 3 dB under a four-voice song; the compressor's
   threshold follows; the master's 0.9 becomes a `music.json` `mix` object (bus trims) so the Studio can set it.
5. Verified by: the battle golden record is untouched (sounds are not in it); the fingerprint baseline for the
   jingles; the owner's phone.

### SND-6 as built (2026-10-23, branch `sound`, tag `snd-6-done` local)
SND-6 had no "Ask me before" item; the owner's standing instruction for the session approved the plan in advance.
One cause per commit, each checked against the commit before it (fingerprints rendered in a worktree):
1. `check-sound.py` renders each cry's low-HP version, the four UI sounds and every jingle at its own tempo and wave,
   when the code has them. Tool only.
2. **Eight base cries** by kind in `music.json` `cries.bases` (beast, bird, slime, machine, fish, insect, ghost, suit),
   each a few notes (`at`, `note` over the species' pitch, `len`; `wave`, `vol`, `slide`, `vib`), named as Claude's
   placeholders; `logic/cries.js` plays a base's notes (the two-note shape left the code); a stage's `cry.base` is a
   kind's name.
3. **A cry per stage** for the 24 Billies (`lines/*.json` `cry`: base, pitch, length, a `name` marked placeholder);
   the Studio's Check lists the placeholder base cries and Billie cries.
4. **The low-HP cry**: a quarter faster and a minor third down (`CRY_LOW`); sound.js `cryPlay`. A Billie cries as it
   comes out (after the pop, as in Gen 1) and as it faints; in the red zone (the music's quarter, from the line's
   snapshot) it cries low.
5. **Four UI sounds** (`music.json` `ui`, `logic/ui-sounds.js`): select (the tick), confirm (a rising fifth: gold,
   green, primary, `shopbuy`, `runstart`), cancel (a falling fifth: quiet, back, `bback`, `baimback`, `dexback`,
   `leaveroom`, `stoptrip`, the scrim), can't (a buzz: a disabled button, on the press). The button is read from the
   event's path, so kit buttons count by their host's `data-a` and kind.
6. **Run-beat jingles** as data: `relic`, `reveal`, `day`, `run_won`, `run_lost`, `payout_coin`; a jingle may set its
   `bpm` and `wave`; `jinglePlay(id, {shift, duck})`.
7. Played at the beats: an arrival plays `day`, then `reveal` when the map shows more; a mini-boss's Loophole taken
   `relic`; the payout a coin per row (two semitones higher each, over the song), then `run_won` or `run_lost` as the
   total lands (`pb-payout` tells the page: `pb-payout-row`, `pb-payout-total`).
8. The full check's "Sound effects and jingles" step (`soundEngine.log` now logs UI sounds, jingles and cries).
9. **The mix** as data (`music.json` `mix`: the bus trims, master 0.9 and ambience 0.9 as before, the compressor);
   then the world and ambience beds 3 dB down under a four-voice song (`bedsUnderSong`, not the title or the fall).
10. The Studio: a Sounds tab (base cries, button sounds, mix); the Jingles card edits tempo and wave.
11. The fingerprint baseline written again (143), in its own commit.

Corrections to this section's plan, found in SND-6:
- Item 1's "a robot's cry comes from its torso part": no robot is heard crying anywhere today (only a wild Billie cried,
  as it appeared, and bots are never wild before RL-14); a robot in battle stays silent. RL-14 adds it (done in RL-14a: logic/cries.js cryOfBot, the machine base pitched by
  the bot's build).
- Item 1's low-HP cry had nowhere to be heard: the game cried only for a wild Billie appearing, at full health. A
  Billie now cries as it comes out and as it faints; SND-3's `cryLowHealth` (slower, a preview only) became the
  plan's faster version.
- Item 1's "about eight base cries ... the Studio card from SND-3 edits them": the card picks a kind; the bases' notes
  are edited on the new Sounds tab.
- Item 2: a disabled button gets no click, so can't plays on the press (pointerdown). Kit buttons (`pb-button`) made
  no tick before: the listener looked for a `<button>` around the shadow host.
- Item 3's "relic picked" is a mini-boss's pick; a shop's Loophole keeps its buy chime. "Run won (the victory tune plus
  the motif)" replaces the payout's plain motif (SND-4's bookend is kept, at its end); the boss battle still plays its
  own victory tune when it ends, before the payout. "Node revealed" plays after the day's tock on the same arrival.
- Item 4's "the master's 0.9" was in two places (`levels.js` and `initSound`) beside the ambience's own 0.9 trim; all
  three are the mix now. "The compressor's threshold follows": nobody has heard the new balance, so it stays at -14 dB
  in the mix, where the Studio sets it.
- Jingle ids must be lowercase (the schema's id pattern): `run_won`, `run_lost`, `payout_coin`.
- SND-2's note that the cries' shape was "still code, for SND-6": it is data now.

### Corrections found in SND-7 (2026-10-27, checked in the code at main 07c9b284)
- The deadline version (SND-5 item 9) went with the run's deadline in RL-R2 (commit 594a094e, 2026-10-23): no
  `trackerDeadline`, no `run.deadlineDays`, no Studio card, no baseline renders. `tools/test/sound.test.mjs` asserts
  there is none.
- The fingerprint baseline holds **194** fingerprints in 26 files (72 song versions, 106 cries with their low-HP
  versions, 12 jingles, 4 UI sounds), not SND-6's 143: the roster's later species and the cave biome's arc bands
  came after.
- Footsteps come every 1.12 m of gait (`FOOTSTEP_M = WALK_SPEED * 0.33`), not every 0.33 m (fixed above).

## Ask me before (collected)
- SND-1 (answered 2026-10-22): jingles stay on Sound effects; volumes stay in the save; the mute beside the sheet's title.
- SND-2 (answered 2026-10-22): the mapping as first guessed (below), not waiting for the Studio; SND-3 lets you hear the pairs, SND-4 revises it.
- SND-3: a Game-group section or a Sound group of its own (answered: a Sound group; also: hooks heard now, cries per
  stage in lines/*.json).
- SND-4 (answered 2026-10-22): Claude writes placeholder hooks, named as placeholders, the owner edits them; the motif
  on the hub and the run's bookends (title, Copperleaf, the take-off, the payout); main merged first; item 6 deferred.
- SND-5 (taken as recommended when the owner said Start, 2026-10-22): the tense variant, the beep a switch off by
  default; the deadline version on the deadline day alone (`run.deadlineDays`, 2 for two); no ghost song before RL-15;
  the weather filter in.
- SND-6: no "Ask me before" item; the plan was approved in advance by the owner's standing instruction (2026-10-23).
- The order of SND-4 to SND-6 after the play test, and whether any of them should go before it.

## Not in this track
Recorded or sampled sound files (the game stays synthesized: no assets, no loading, no licensing); a music volume
per song; voice; haptics beyond what exists; the step counter's sounds (removed with it).

---

# Part 2 (SND-7 onward): layered music and a gentle world

The owner's brief (2026-10-27): "Make a plan how you could expand on the current sound system. It can have more
layers and complexity. The music can have more style and layers for example, it doesn't have to fully be 8bit.
Don't make environmental sounds too loud and obnoxious. Overall improve the sounds of water and stuff. Do research
online and make suggestions." Planned in Plan Mode in SND-7 (branch `ccr-1e8a9924-tt5x1q`, docs and a private
listening page only); every later session works on `track/sound`, made by the owner from main. Tags `snd-N-done`
(the owner pushes tags).

## The owner's answers (2026-10-27, Plan Mode)
| Question | Answer |
|---|---|
| The music's direction | **A mix of Chip+ and DS-era Pokémon**: chip leads stay the signature; synthesized strings, brass, flutes, timpani, pads, bells, fuller drums and reverb around them |
| Sound files | **Synth only** (no audio files; Part 1's rule stays) |
| What bothers you today | **All four groups**: water; rain and wind; birds and crickets; steps, fire and the town's murmur |
| Layer ideas | **All four**: a walking beat, street musicians you hear as you pass, weather and night versions, intensity that builds |

## In short
- **Why the world sounds grate**: every water, rain, wind and fire sound is the same 1-second white-noise loop with a
  steady wobble; rain is louder than the music (+7.8 LU, measured); crickets are two endless ~4.5 kHz tones; birds
  call every ~3 s; footsteps are one identical click. And **the hub song is 15 LU quieter than the route song**, so in
  Copperleaf the sea (+5 LU) and a fountain (+10 LU) drown it.
- **SND-8a and SND-8b, quick relief**: soft pink/brown noise that never audibly loops, random drift instead of wobbles; rain,
  crickets, fire, birds and steps re-voiced and quieter; songs level-matched; silent sounds stopped (today they cost
  the phone more than the music does); a loudness check so it stays that way.
- **Music, Chip+ meets DS-era**: still synth only, but instruments are computed once into memory (a DS sound bank we
  compute instead of load): strings, brass, flute, harp, accordion, bells, timpani, fuller drums and reverb around
  the chip lead; longer songs with A and B sections. **GB Sounds** keeps the 8-bit versions as a switch.
- **Layers that react**: a walking beat, street musicians, rain/snow/night versions, battles and runs that build up
  instead of switching songs.
- **Water rebuilt**: a sound for each of the 15 water kinds, placed in the world; far water soft and low, near water
  bright.

## What the music does today (checked at main 07c9b284, 2026-10-27)
- `game/js/audio/tracker.js` (708 lines): three instruments (`synthVoice`: an oscillator, a linear ADSR, an optional
  low-pass and vibrato; `synthNoise`; `synthKick`), three pulse PeriodicWaves (12.5, 25, 50 %), one echo (0.27 s,
  feedback 0.28, wet 0.16). Every song is 8 bars of 16 steps that loop (16-20 s). The composer writes the lead, hook,
  counter and intro; bass, arp, drums and the pad are fixed patterns in `tick`. The four-voice rule is
  `four = !D.extra` (tracker.js:453).
- `music.json`: 23 songs (17 with a placeholder hook), 12 jingles, 8 base cries, 4 UI sounds, the mix, `run`
  (weather cut-offs, arc bands `mid` and `late`), 29 where-rules. Versions: night, tense (the red zone), arc bands.
- A walking beat's seed is there: sound.js `L.drums` is 1 while walking or in battle, else 0.45, times 1 − 0.4·night.
- No ConvolverNode, AudioWorklet or WaveShaper anywhere; StereoPanner on ambience and effects, never on music.
- **Bugs** (SND-8b): `echo: 0` would play as 0.15 (`D.echo || 0.15`, tracker.js:436, 479; no song writes 0
  today); the echo send is taken before the song's gain, so echo tails ignore crossfades and jingle ducks; jingles
  (echo 0.2, tracker.js:688) and two effects, heal and seal (sound.js:504, 539), echo onto the music bus (under the
  Music slider and the rain low-pass); `old.fade` is written and never read.
- Tests: `tracker.test.mjs` (16), `sound.test.mjs` (17), levels, cries, ui-sounds, music-studio; `check-sound.py`'s
  194 fingerprints (RMS per 50 ms, mono, 44.1 kHz, seeded random). The after-edit hook runs no unit test for edits to
  tracker.js or sound.js: run `node --test tools/test/tracker.test.mjs tools/test/sound.test.mjs` by hand.
- **Loudness** (each song's RMS over its fingerprint render, default sliders): copperleaf **−52.0 dBFS**; town −33.3,
  route −34.3, the battle songs about −32, cave and hazel −37.9. Apart from the hub song they span about 6 dB.

## What the world sounds do today, and why they grate (sound.js, 2026-10-27)
- **One 1-second white-noise buffer** (`T.noise`, tracker.js:215) feeds every bed (`initAmbience`, sound.js:817),
  looped at rates 0.5-1: each bed repeats every 1-2 s ("frozen noise" the ear learns), and white noise puts most of
  its energy in the 2-8 kHz band where hearing is most sensitive.
- **Regular sine tremolos** stand in for life: stream 2.7 Hz, fountain 5.5 Hz, fire 11 Hz (a buzz, not crackles),
  sea 0.09 Hz (an even swell every 11 s), pond 0.35 Hz. LFO depths over 0.5 swing the gain negative (sea, pond, fire,
  lava, wind, leaves): two uneven dips per cycle.
- **The beds** (filters; gain at the source, times the World or Ambience bus): stream bp 1500 + hp 500 (0.5 within
  10 m); falls lp 1000 + hp 90 (0.7, 14 m); sea lp 650 + hp 60 (0.35 anywhere in a sea scene, 0.6 near water); pond
  bp 520 (0.22); fountain bp 2400 (0.45); fire bp 3000 (0.35); lava lp 260; **rain hp 1700 + lp 7500 (up to 0.42)**;
  wind bp 360; leaves bp 3200 + hp 1200; town murmur bp 420 + lp 900 (0.13); cave lp 140 plus a constant 49 Hz sine;
  room lp 260.
- **Levels against the music, measured** (SND-7's listening page: sound.js's beds ported line for line, rendered
  offline at 48 kHz through the game's default mix, beds 3 dB under a song as in play, K-weighted per ITU-R BS.1770;
  LU against the route song, −32.4 LUFS): **rain +7.8 LU** (louder than the music, while the music is low-passed to
  2.2 kHz in the rain, sound.js:1160); crickets −4.1; a fountain at 3 m −5.1; a stream at 3 m −6.8; a campfire at
  2 m −9.1; the sea anywhere in Copperleaf −9.8; storm wind −10.3; birds −22.6 (calls peaking at −14.8); steps on a
  lawn −23.7 (peaks −20.5). **The hub song is 15 LU quieter than the route song** (copperleaf −47.4 LUFS; 19 dB by
  plain RMS: the music box alone, short decays, no bass), so **in Copperleaf the sea sits 5.1 LU over the hub song
  and a fountain at 3 m 9.9 LU over it**. Songs otherwise span about 6 dB of RMS (wild −31.5 dBFS to cave −37.9).
- **Crickets**: two pure sines at 4300 and 4650 Hz gated on and off by square LFOs (26 Hz and ~0.8 Hz), all night.
- **Birds**: pure-sine chirps at 2.9-5.1 kHz with linear envelopes, a call every ~3.3 s outside towns (`dt*0.3` per
  200 ms tick, sound.js:1213), every ~8 s in town.
- **Footsteps**: one band-passed noise tick per step (about 0.35 s apart walking, 0.2 s running), the same every
  time, on the Sound effects bus (default gain 0.64, against the World bus's 0.25). The "hard" click also covers
  lawn, forest floor, sand, dirt, mud, marsh and water.
- **Water gaps**: placed waterfalls (`sc.falls`, the big set pieces) are silent and a fall's height is ignored; in a
  sea scene every water cell, rivers too, plays the sea; every still kind (lake, hot spring, bog, oasis, reef, cave,
  ice) plays one 520 Hz "pond"; rapids sound like a stream; wading and Surf play the hard click; fishing's cast and
  bite play a grass footstep; no reel or catch sound; rain on water is silent.
- **Other gaps**: thunder is polled every 200 ms but a flash stays bright ~31 ms (environment.js:418), so about five
  flashes in six are silent, and with reduced motion or flashes off there is no thunder at all; indoors the night
  reads 0 (environment.js:396), so rooms hear daytime birds at night and never the rain on the roof;
  `soundEffectAt` leaves its panner connected; no voice limit on birds, plops or one-shots.
- **Placement**: one bed per kind, the nearest source wins (`nearestSoundSource`), volume `(1 − d/range)^1.6`, pan
  from the camera's right vector; a room muffles the outside with a low-pass (620/850 Hz).
- **Load**: the 14 beds start once and never stop, even silent: about 120 nodes always on (13 looping sources, 17
  oscillators, 23 biquads), more than the music's 4-12 sources. Every 200 ms `updateAmbience` scans every water cell
  (14,010 in Copperleaf) and walks the props three times. Only the legacy v31 note ("world sounds start at half the
  loudness they had") ever touched their level.
- The world already knows its water: 15 kinds (`logic/water-kinds.js`: pond, stream, canal, spring, swamp, lake,
  sea, lava, ice, rapids, hotspring, oasis, bog, reef, cave), rivers with sources, mouths and rapids, `falls` with
  their height, Copperleaf's fountain, wading (WA-6a), Surf (WA-6b), water life (WA-5b). Six water beds exist.
- The water track's **WA-8** still lists "water sound beds (falls by height, rapids, surf, lapping, the plunge
  pool) with SND-6's mix" (water-track.md). Part 2 proposes SND-10 takes them (Ask me before).

## The research, in short (2026-10-27)
Music that reacts:
- **Pokémon Black 2/White 2**: street musicians whose instrument joins the town music "within earshot" (Nacrene's
  accordion, Opelucid's keytar or erhu, Village Bridge's four players, Anville's flute); Virbank's Gym band gets
  louder deeper in and loses instruments as you beat its members; **Route 1 adds a tambourine and most routes a
  snare "when you make steps"** (Black/White did it too); seasons change arrangements (Undella's summer steel drums,
  winter chimes on Routes 19 and 20); caves slow down and drop lower as you go deeper.
  [Serebii B2W2 music](https://www.serebii.net/black2white2/bgmusic.shtml), [Serebii BW music](https://www.serebii.net/blackwhite/bgmusic.shtml)
- **HeartGold/SoulSilver's GB Sounds**: a key item that swaps every song for a chip version (effects unchanged).
  The model for keeping the 8-bit songs as a switch. [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/GB_Sounds)
- **Super Mario World**: a bongo layer joins while you ride Yoshi, the classic vertical layer.
  [Game Developer](https://www.gamedeveloper.com/audio/2-ways-to-create-interactive-music-in-your-games),
  [Mario Wiki](https://www.mariowiki.com/Ground_BGM_(Super_Mario_World))
- **Animal Crossing: New Horizons**: every hourly song has a rain version (a light ringing added) and a snow
  version (sleigh bells). [VGC](https://videogameschronicle.com/news/gallery-heres-animal-crossings-huge-japan-only-music-collection),
  [Nookipedia: Snow](https://nookipedia.com/wiki/Snow), [USC Scalar](https://scalar.usc.edu/works/video-game-music-transcription/animal-crossing-music-an-introduction)
- **Breath of the Wild**'s day field music: solo piano with more silence than melody, so the world is heard.
  [Zelda Dungeon](https://www.zeldadungeon.net/musical-musings-listening-closely-to-the-emptiness-of-breath-of-the-wilds-hyrule-field-day/)
- **A Short Hike**: the score shifts with the weather and when you fly. [Wikipedia](https://en.wikipedia.org/wiki/A_Short_Hike), [press kit](https://ashorthike.com/press/)
- **DS-era Pokémon** played sequences through sampled instruments (an SDAT holds sequences, instrument banks and
  wave archives): the same model works with instruments we synthesize ourselves.
  [ndspy: SDAT](https://ndspy.readthedocs.io/en/latest/appendices/sdat-structure.html)
- Recipes for the DS-era palette: Sound On Sound's Synth Secrets (plucked strings, brass, simple flutes, string
  machines and PWM pads, bowed strings, [timpani](https://www.soundonsound.com/techniques/practical-percussion-synthesis-timpani)).
  [Index](https://www.soundonsound.com/synthesizers/synth-secrets)
- Craft: layers written to combine, driven by progress, place or intensity ([Winifred Phillips, GDC 2021](https://www.gamedeveloper.com/game-platforms/pure-vertical-layering-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-));
  section changes on bar lines with bridges ([CRIWARE](https://blog.criware.com/index.php/2020/05/20/dynamic-music-with-adx2-part2-horizontal-sequencing/));
  Celeste's whole FMOD project is published to study ([FMOD](https://www.fmod.com/docs/2.03/studio/appendix-a-celeste.html));
  cozy game music sits at 60-100 bpm with extended chords, sustained chords and arpeggios, airy pads
  ([Orchestral Tools](https://www.orchestraltools.com/tips-for-cozy-game-music)).

Water and nature, synthesized:
- **van den Doel, "Physically-based models for liquid sounds"** (ACM TAP 2005, [PDF](http://www.cs.ubc.ca/~kvdoel/publications/tap05.pdf)):
  a bubble is `a·sin(2πft)·e^(−dt)` with f = 3/r (r in metres: 1 mm → 3 kHz), d = 0.13/r + 0.0072·r^−1.5, the pitch
  rising f(t) = f0(1 + ξ·d·t) (ξ ≈ 0.1 for drops, 0.5-1 for bigger bubbles); radii of 2-7 mm sound most like "a water
  drop"; rates ∝ 1/r^γ (γ 0-3 for streams, about 5 for rain); up to ~1,000 bubbles a second is a brook or light
  rain, ~100,000 a waterfall. In Web Audio the rise is a `linearRampToValueAtTime` and the decay a
  `setTargetAtTime(0, t, 1/d)`; baked into a bank, a bubble costs one buffer source.
- **Andy Farnell, Designing Sound** (MIT Press; companion patches: [fire](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical11.html),
  [bubbles](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical12.html),
  [running water](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical13.html)):
  running water is a sine whose pitch jumps at random in 800-2400 Hz every few ms with a short glide, its loudness
  following how fast the pitch moves, three such layers (every 2, 6 and 12 ms; depths 800, 600, 400); a bubble is a
  sine rising exponentially (×1 to ×2.7) with a 10 ms attack and 80 ms decay; cave drips are a "drip factory" through
  reverb; fire is crackles (short noise bursts band-passed near 1.5-2 kHz at a random centre), hiss (high-passed
  noise moved by slow noise) and lapping (noise low-passed near 30 Hz, clipped), from one noise source; rain, wind,
  footsteps, insects and birds have practicals too. The patches state no licence: learn from them only.
- **Ocean shore** (PortAudio's `paex_ocean_shore.c`, MIT-style licence, [source](https://files.portaudio.com/docs/v19-doxydocs/paex__ocean__shore_8c_source.html)):
  each wave is pink noise rising over a random 2-6 s while a low-pass opens, falling about four times as long while
  a high-pass closes, peak 0.1-1, a new wave every 1-4 s, overlapping, each panned at random.
- **Pink and brown noise**: Paul Kellet's pink filter; brown = (last + 0.02·white)/1.02
  ([noisehack](https://noisehack.com/generate-noise-web-audio-api/)). Fill long looping buffers once.
- **Birds** as swept chirps with fitted frequency curves for ~130 ms chirps ([Cornell ECE 4760](https://people.ece.cornell.edu/land/courses/ece4760/labs/f2021/lab1birdsong/Birdsong_keypad.html));
  DSP-only multi-species bird soundscapes with spatial placement ([arXiv 2511.19275](https://arxiv.org/abs/2511.19275v1)).
- **Ambience that doesn't tire**: a bed plus occasional one-shot "sweeteners" 5-10 s apart, several variations
  each, the next waiting for the last ([Eon Altar, Game Developer](https://www.gamedeveloper.com/audio/video-game-audio-under-the-hood-eon-altar-ambience-system));
  a 9 s bed, a crow at 50 % chance with ±60 cents, a 90° pan spread and a 10 s lockout, 5 s of jitter so nothing
  lines up with the loop ([CRIWARE](https://blog.criware.com/index.php/2020/12/14/ambience-design-in-atom-craft-part-1-2/)).
  Cozy means nothing sudden or out of proportion: soft, continuous sound from sources you can see
  ([Lost Garden, Cozy Games](https://lostgarden.com/2018/01/24/cozy-games/)).
- **Phone speakers** roll off below ~600 Hz and above ~9 kHz: check a mix through a 400 Hz-6 kHz band
  ([Sonarworks](https://www.sonarworks.com/blog/learn/make-your-mix-sound-great-on-small-speakers)). A bed's size
  must come from its mids, not its lows.
- **Mobile loudness**: about −18 LUFS ±2 integrated for portable games (Sony's Vita figure,
  [interview](https://designingsound.org/2012/07/30/video-games-and-loudness-standards-interview-with-sonys-garry-taylor/);
  [Audiokinetic](https://audiokinetic.com/ko/blog/mastering-a-game-with-wwise-part1)), −16 in the
  [IESD levels](https://www.audiogang.org/wp-content/uploads/2015/04/IESD-Mix-Ref-Levels-v03.02.pdf), true peaks
  under −1 dBTP; a small loudness range, a gentle master compressor (threshold under −40 dBFS, ratio 1.2-1.5, release
  over 1 s), ambience ducked under important sounds ([Rodrigue, designingsound.org](https://designingsound.org/2013/02/20/different-loudness-ranges-for-console-and-mobile-games)).
- **Instrument recipes**: an FM bell at 1:2.8 with the index falling 6 → 0, a trumpet at 1:1 with the index 5 → 0
  ([Columbia](https://sites.music.columbia.edu/cmc/MusicAndComputers/chapter4/04_07.php)); the DX7 e-piano's 14:1
  "tine" ([muzines](https://www.muzines.co.uk/articles/yamaha-dx7/4733)); extended Karplus-Strong
  ([JOS, CCRMA](https://ccrma.stanford.edu/~jos/pasp/Extended_Karplus_Strong_Algorithm.html)). A DelayNode in a
  feedback loop can't go under 128 samples ([the spec](https://www.w3.org/TR/webaudio/)), so a live Karplus-Strong
  string tops out near 375 Hz at 48 kHz: one more reason to bake plucks in JS.
- **Phone Web Audio** ([Adenot's performance notes](https://padenot.github.io/web-audio-perf/)): biquads and buffer
  playback are cheap; a ConvolverNode is expensive and grows with its impulse (keep one, keep it short, or use a small
  delay/all-pass reverb); render buffers at the context's own sample rate (WebKit has had distortion bugs on
  mismatched rates). iOS: AudioWorklet from 14.5; a context can stay "interrupted" after Safari loses focus, fixed by
  `suspend()` then `resume()` ([WebKit 276016](https://bugs.webkit.org/show_bug.cgi?id=276016)); the silent switch
  mutes Web Audio unless `navigator.audioSession.type = 'playback'` (iOS 17+, experimental,
  [WebKit 264473](https://bugs.webkit.org/show_bug.cgi?id=264473)).
- **Code we may borrow** (permissive): Tone.js (MIT; its reverb renders a stereo noise impulse offline, decay 1.5
  s), ZzFX and ZzFXM (MIT), jsfxr (Unlicense), the PortAudio ocean example (keep its notice). **Learn from only**:
  Strudel (AGPL), WebPd (LGPL), Farnell's patches (no licence), van den Doel (write the maths ourselves).
- Not confirmed, so not used: a standard "ambience N dB under the music" figure; Balatro switching its theme's
  variants in play; Hades' and Slay the Spire's music systems.

## The design
1. **Baked instruments, still synth only.** Pure JS DSP (FM, Karplus-Strong plucks, detuned stacks, formant filters,
   shaped noise) renders each instrument's notes once into memory (a sample per octave or so, loop points for
   sustained sounds), like a DS sound bank we compute instead of load. A note then costs one buffer source and one
   gain. Deterministic, so the fingerprints keep working; testable in Node. Built lazily per song or scene in idle
   slices (or a Worker), never in a frame over 33 ms (the Load track's rule). Budget: about 6 MB resident.
2. **Ensembles: Chip+ meets DS-era.** music.json gains `instruments` (presets) and `ensembles` (for each part: an
   instrument, octave, pan, reverb send and level). The chip lead stays the voice of most songs; around it strings,
   pizzicato, harp, brass, flute, clarinet, accordion, e-piano, mallets, bells, music box, a choir pad, timpani, an
   orchestral kit, a brush kit, tambourine and shaker. Moods by place: Copperleaf cozy (music box, harp, flute, soft
   strings); routes adventurous (chip lead, strings, pizzicato, snare); towns (accordion or e-piano, walking bass);
   caves sparse (bells, a drone, reverb); battles DS-style (chip lead over a string ostinato, brass stabs, timpani,
   a full kit); bosses grander (choir, hits). The `gb` ensemble is today's four voices, bit for bit until a song is
   re-arranged; after that it plays the new arrangement on the four chip voices (HeartGold's GB Sounds were chip
   re-arrangements too). **Settings → Sound → GB Sounds** switches every song to it.
3. **Stems and layers.** Each instrument line plays into its own small bus, a **stem** (gain, pan, reverb send). A
   layer is a set of stems whose gain the game moves, always on a beat or a bar line. The four layer ideas:
   - **Walking beat**: a tambourine (Copperleaf) or snare (routes) part fades in on your first steps and out about a
     bar after you stop (today's `L.drums` 1/0.45 is its seed).
   - **Street musicians**: a part placed in the world (the busker's case, HB-10d; festival players, HB-10e); its gain
     follows your distance (earshot about 8 m), its pan your direction.
   - **Weather and night**: rain adds a light ringing (bells) and brushes, snow sleigh bells, a storm low strings and
     timpani rolls; night swaps the lead for flute or e-piano and thins the drums (today's night version stays).
   - **Building intensity**: battles build from the intro to full as turns pass, KOs land, the red zone hits and a
     boss changes phase; the run's arc (rows 3-5, 6-8) adds layers instead of swapping versions.
4. **Longer songs.** Sections A and B (a contrasting progression), 16-32 bars a loop, fills and turnarounds at the
   section ends, seeded variation on repeats. The composer stays pure; the hooks stay the owner's to edit.
5. **Space.** One reverb bus that music, effects and the world send to: a single ConvolverNode with a short
   generated impulse (stereo decaying noise, at most ~1.2 s: open air, town, forest, cave, room), swapped by place;
   a small delay/all-pass reverb replaces it if the phone shows it costs too much. Stereo pans on the music's parts.
   Every baked buffer is made at the context's own sample rate.
6. **A world from data.** `soundscape.json` (schema, a Studio tab): each kind a recipe of layers: a **bed** (pink or
   brown noise, filtered, moved slowly and at random), a **texture** (a baked loop played from random offsets) and
   **events** (one-shots from a baked bank: bubbles, laps, drips, crackles, chirps; rate, pitch, level and pan
   randomised; a minimum gap). Emitters come from the scene: river lines, shores, falls by height, props. The nearest
   few per kind play, with distance, pan and air absorption (far water a soft low rumble, near water bright). Silent
   beds stop.
7. **Gentle by rule, checked by a tool.** No white-noise beds; beds high-shelved above ~6 kHz and high-passed where
   they need no lows; random drift, never a regular LFO; one bird at a time; crickets sparse and low. A loudness
   report (K-weighted, BS.1770-style) per bed and song in check-sound, with ceilings: the music near −18 LUFS at
   default sliders, beds at least 12 dB under it, events at least 8 dB under.
8. **A Sound Test for the phone.** A debug-menu page (the Studio is for a computer): every song by ensemble with its
   layers as switches, every bed with a distance slider, GB Sounds on and off. Each session's listening list points
   there.

## Sessions
| # | Session | Goal | Depends on | Fingerprints that change |
|---|---|---|---|---|
| SND-7 (done 2026-10-27) | Plan and listening page | this Part 2; a private listening page (Today vs Calm, new water, the music styles and layers) | none | none |
| SND-8a | Calm beds | the beds gentle and cheap (their own pink/brown noise, drift instead of LFOs; rain, crickets, fire, stream, fountain, sea, leaves and town re-voiced; birds one at a time and rarer; footsteps varied and soft; rooms read the place's night; beds start and stop), the loudness report, the debug log's audio lines, the Sound Test v1 | none | none |
| SND-8b | Mix fixes | the echo bugs, a level trim per song (the hub song up, from the report: data, not the player setting Part 1 ruled out), the rain's music low-pass, iOS's "interrupted"; the baseline written again in its own commit | SND-8a | the jingles; every song's first ~1.5 s; copperleaf |
| SND-9 | Bake and reverb | `logic/sound-bake.js` (pure DSP, Node-tested), the tracker's bank and `sampleVoice`, the reverb bus, one proof instrument in the Sound Test, bake time and memory in the debug log, a brightness fingerprint (a tool commit first) | SND-8b | none (brightness added) |
| SND-10 | Water | `soundscape.json` and emitters, a recipe per water kind, the placed falls by height, rain on water, wading, Surf, fishing and water life; takes WA-8's water sounds if the owner agrees | SND-9 (WA-11 for the hub's fall) | none |
| SND-11 | Stems and ensembles | the tick's patterns factored into pure functions; stems; `instruments` and `ensembles` in music.json; `gb` reserved for today's code; GB Sounds; the first ensembles; the Studio's Instruments tab and its mix on the game's chain | SND-9 | none: the new `gb` must equal the old by day and night |
| SND-17 | Jingles and stingers | the 12 jingles given the new instruments (a DS fanfare for victory, a glockenspiel and harp run for a level-up, strings swelling into an evolution...), stingers on the song's beat and in its key, GB Sounds keeping today's 8-bit ones; added at the owner's question (2026-10-27) | SND-11 | the 12 jingles |
| SND-13 | Layers in play | the walking beat, weather and night, building intensity, street musicians (simulated until the busker resident, RS-5) | SND-11 | the layers' renders |
| SND-12 | Arrangements | A/B forms of 16-32 bars (`prog` loses its fixed 8), fills, new lines; every song re-voiced as named placeholders, in batches the owner approves | SND-11 | the songs rewritten |
| SND-14 | Nature and weather | rain by intensity (a wash, patter, roofs), thunder by a bolt counter and distance (not the visual flash), wind and gusts, leaves, birds by biome and hour (a dawn chorus), insects, frogs, fire, footsteps by surface, town life instead of a murmur, room tones | SND-10 | none |
| SND-15 | Mix and phone pass | about −18 LUFS through the master, the compressor and a limiter; ducking (jingles, cries, talk); slider defaults; the owner's phone; Studio polish | all | as needed |
| SND-16 (optional) | Effects pass | battle hits, throws and catches with body and space; sounds for things that have none (the airship's engine, the sky train and its rail, the world map, steam vents, wells) | SND-9 | the effects |

SND-17 needs only SND-11's instruments, so the jingles come early. SND-13 may come before SND-12 (layers work on the
first ensembles; arrangements are long and go in batches), and the world (SND-10, SND-14) and music (SND-11..SND-13)
lanes can swap at the owner's word. Each is 1-2 sessions, about 12-15 in all. Engine pieces land with their first
audible use, so no session builds what nobody can hear yet. Every audible change is the owner's call by ear (Claude
can't listen): each session ends with a listening list for the Sound Test on the phone. A session that changes
fingerprints writes the baseline again in its own commit (the full check fails until then), once a render of each
commit against the one before it, in a worktree, lists exactly the planned changes.

**Names** (from the code review, 2026-10-27): "parts" already means a song's versions (`musicParts`, trackerRecipe's
`@` parts, check-sound's `parts`), so an instrument line's bus is a **stem**; new names take prefixes that clash with
nothing (`musicStem*`, `musicLayer*`, `soundBake*`: "layer" appears ~90 times in the render code and "bake" is the art
bakes' word).

## How the sessions run (the owner, 2026-10-27)
The owner, after SND-7: "Continue with next steps in this plan automatically in new sessions. Automatically approve
plans." So, as the UI track's Part 2 does:
- The planning session (SND-7's, `session_019UpAFxCHyLNWb1TCD6L3vh`) starts each step in a new cloud session on
  `track/sound` when the step before has pushed its HANDOFF entry. Order: SND-8a, SND-8b, SND-9, SND-10, SND-11,
  SND-17, SND-13, SND-12, SND-14, SND-15. SND-16 (optional) waits for the owner's word.
- A step reads CLAUDE.md, ROADMAP, VISION, the top of HANDOFF and this file's Part 2; checks that it is on
  `track/sound` and merges main into it first; writes its plan into its HANDOFF entry and goes on without waiting for
  approval. Where it meets an open choice or an "Ask me before" item it takes the recommended option and lists it in
  its HANDOFF entry under "Decided for the owner, to review"; the phone checks are listed, not waited for.
- It commits one cause per commit, runs the checks this file names, pushes to `track/sound`, keeps one draft PR from
  `track/sound` to main up to date, and notes its tag (`snd-N-done`) for the owner to push.
- When it is done it tells the planning session with `send_message`; an hourly check in the planning session covers a
  missed message. A step that can't finish (a check it can't make pass, Start-Game, phone mode, the Studio or the
  in-game full test broken) stops the chain, says why in its HANDOFF entry and its message, and the planning session
  asks the owner.
- Merges to main stay the owner's.

## The listening page (SND-7)
A private artifact for the owner's phone (nothing committed): https://claude.ai/artifact/GuTVE9L1WfjFWVc4NPe9oh.
Self-contained Web Audio (the game's tracker.js copied in unchanged, plus the sketch code); the owner's own link.
- **Today vs Calm**: rain, stream, fountain, sea, crickets, birds, a campfire, footsteps, storm wind. "Today" is
  sound.js ported line for line; "Calm" is what SND-8a would make of it. The route song or Copperleaf's (today or
  level-matched) can play under them at the game's default balance.
- **New water**: brook, river, rapids, a 1.6 m and a 10 m fall, surf, lake, a pond at night (plops, frogs,
  crickets), fountain, hot spring, cave drips; a distance slider (1-40 m: quieter, duller and roomier further off).
- **Music**: Copperleaf and Route with the real composer and notes, as GB today, GB level-matched (the hub song
  +13.4 dB), Chip+ and Chip+ DS; layers: hold to walk (a tambourine in Copperleaf, a snare on the route), a busker
  (an accordion playing Copperleaf's motif, 1-11 m), clear/rain/snow, night, intensity 1-3. In GB, intensity 2 and 3
  are today's run versions (`@mid`, `@late`) and walking lifts today's drums from 0.45 to 1.
- **Measured** (LU against the route song): Calm rain −14.0, stream −15.0, fountain −16.0, sea −18.0, crickets −19.4,
  birds −31.1 (peaks −16.9), campfire −14.9, steps −27.2 (peaks −23.9), wind −14.0. New water at 3 m: −12 to −18 (a
  brook at 20 m −20, the tall fall at 30 m −16.7). The bands sit at their songs' level (route −32.4, Copperleaf −34.0
  LUFS), intensity 3 about 3.6 LU fuller; a band bakes 18-27 instrument zones in 50-370 ms on a computer and holds
  1.2-4 MB.
- Checked in headless Chromium: every sound rendered offline (no NaN, no clipping: peaks −14 dBFS or lower), the page
  clicked through at 390 px in light and dark with no console errors and no sideways scroll.
- Found while building it: a reverb's return must go back through the bus it serves (music, world), or the slider
  doesn't scale the room; the page had that bug for a moment (cave drips measured 11 LU louder).

## SND-8a: calm beds (draft steps from the code review; the session's own plan refines them)
Check-sound renders only songs, jingles, cries and UI sounds, through `initSound` with `Math.random` seeded per job;
beds, birds and steps never render. So none of this changes a fingerprint, as long as nothing touches `T.noise`,
`initSound` or the defaults of `synthVoice`/`synthNoise`, and nothing new calls `Math.random()` in `initSound` or the
tick (one extra call moves every drum hit's offset, tracker.js:311).
1. The after-edit hook (tools/after-edit.mjs) also runs `node --test tools/test/tracker.test.mjs
   tools/test/sound.test.mjs` for edits to `audio/` and sound.js.
2. **The loudness report**: `check-sound.py --loudness`, computed in the page on each render: K-weighting (BS.1770's two
   biquads, recomputed for 44.1 kHz), 400 ms blocks with −70/−10 gating for integrated LUFS, the 3 s maximum, the
   peak, a 400 Hz-6 kHz "phone band" level and the 2-6 kHz share. Bed jobs (12 s each) and scene jobs (the
   Copperleaf square, a route in rain, a meadow at night), reported as LU under the song. The baseline's format is
   unchanged; ceilings only warn until SND-15. (Mono: the relative numbers hold for centred beds.)
3. **The debug log's `audio` lines** (debug-log.js:985): live beds and their gains, sources started per minute, the
   scheduler's late steps, context state changes, latency; `updateAmbience` in the timed list. No save data.
4. **Pure helpers in `logic/`**, tested in Node: noise colours, random drift, event planners (a bird lockout, cricket
   groups, crackles, step variation); `ambiencePreview(kind, distance)`, shared by the report and the Sound Test.
5. **The beds' own noise**, made in `initAmbience` (check-sound never calls it) by its own seeded generator: pink about
   6 s and brown about 8 s at the context's rate, the loop seam crossfaded (brown clicks once a loop otherwise);
   `loop()` (sound.js:840) takes the buffer. About 2.6 MB and 5-10 ms, spread over a tick or two.
6. **Random drift** folded into the per-tick `setTargetAtTime` (sound.js:1144): no nodes; the 10 LFO oscillators and
   the negative gains go together.
7. **Beds start and stop** with hysteresis, stopping only near zero gain (no click). `ambience.beds` stays a registry,
   so the Animals step's "≥ 9 beds" (check-quick.py:1164) holds; the step then asserts which beds are live.
8. **Water cells bucketed** per scene (the same answers, faster; a Node test).
9. **Re-voiced, one commit each**: rain; crickets (chirp groups as events); fire (a low roar and crackles); stream;
   fountain; sea (two drifting layers, the coast-wide level lower); leaves; the town.
10. **Birds**: one at a time, about one call in 10 s outside towns, quieter and lower.
11. **Rooms read the place's night** (no daytime birds in a room at night).
12. **Footsteps**: a little random pitch and level per step; the natural grounds (lawn, forest floor, sand, dirt, mud,
    marsh) on the soft step (the regex at sound.js:429); which bus is an Ask.
13. **Bed trims** set from the loudness report.
14. **The Sound Test v1**: a `sound` section in debug-menu.js (sections ~304-316) whose body comes from a new
    `game/js/sound-test.js` loaded after sound.js; buttons `data-x="snd…"` with a prefix branch in `debugAction`
    (debug-menu.js:421); any song, any bed at a distance; plays through `soundEngine`, never writes the save, stops
    on close. check-quick.py:673's section list updated; no button label containing "scrap" (the search check expects
    only "+50 Scrap").
Verified by: the loudness report before and after; `check-sound.py` (0 changed in every commit); the smoke check;
`python3 tools/check-quick.py --steps=sound,song,music,"debug menu"`; the full check at the end. The owner's phone, on
the speaker and on headphones: Copperleaf (the sea never covers the hub song), forced rain, a night, a forest, a
campfire, walking and running; no hiss, whine or buzz; one bird at a time; soft, varied steps; in the debug log few
beds live and 0 late steps.

## SND-8b: mix fixes (draft)
Each commit rendered against the one before it in a worktree, as SND-6 did; then the baseline written once, with plain
`--baseline` (never `--baseline --only=X` for a jingle or a cry: it rewrites X's whole file, keeping only X).
| Commit | Fingerprints that change |
|---|---|
| `D.echo ?? 0.15` (tracker.js:436, 479) | none |
| The song's echo after its fader; one helper for play, crossfade, stop and duck (tracker.js:377-385, 390-396, 673-704) | every song, the first ~1.5 s (the fade-in now reaches the echo) |
| Effects' echo on its own delay (`echoTo`, default `T.echoIn`) | the 12 jingles |
| `old.fade` removed | none |
| A `trim` (dB) per song, in both schema places | none |
| Copperleaf's trim, from the K-weighted report | copperleaf, day and night |
| The rain's cut-off on the music (Ask) | none |
| iOS `interrupted`: suspend, then resume | none |
| The baseline written again | (the list above) |
Phone: with Sound effects at 0, no jingle echo is left; the echo ducks under a jingle; sound comes back after Siri or
a call (the silent switch still mutes everything).

## SND-9: bake and reverb (draft)
1. A brightness fingerprint (zero crossings per 50 ms) beside the RMS, in a tool-only commit; the RMS arrays identical.
2. `logic/sound-bake.js`: pure (it renders numbers and plays nothing, like logic/cries.js; NAMING.md allows it in
   `logic/`, which also gets `npm test` on edit and the logic typecheck): band-limited oscillators, envelopes, a
   biquad, FM, Karplus-Strong, its own PRNG; it outputs noise, stereo impulses and instrument zones;
   `tools/test/sound-bake.test.mjs` (the same output every time, no NaN, peaks at most 1, seamless loops, a size
   budget). A script tag on both pages before tracker.js (game/index.html ~150, studio/index.html ~71-75), then
   `npm run modules` (hand-written imports throw).
3. **The bank**: a module-level cache in tracker.js keyed by (instrument, rate), since AudioBuffers work in any context
   (check-sound's per-job `initSound` doesn't bake again); `T.sampleVoice` costs one source and one gain; `bankReady`
   async from day one; baking in setTimeout slices of at most 4 ms (iOS Safari has no requestIdleCallback; boot.js:131
   already falls back); baked on arrival (the scene's songs and the battle ensemble), the least recently used dropped,
   within ~6 MB with the bed buffers (about 1.5-3 MB an ensemble, zones pruned to the notes its songs use). A Worker
   only if the log shows the need (a worker entry, a `*-worker-modules.js`, vite.config.js:169-174, an equality check).
4. **The reverb** lives with the tracker (the Studio loads tracker.js, not sound.js), made lazily so `gb` never makes
   it; post-fader send buses scaled with each slider in `applyVolumes`, returning to the master (or it repeats the
   echo's wrong-bus bug); one impulse of at most 1.2 s, set once and timed (assigning the buffer works on the main
   thread); places differ by send level; a second convolver only for caves.
5. One proof instrument in the Sound Test; bake ms and MB in the debug log.
Phone: the bake's time, no hitch in the Load track's hitch list, the proof instrument heard.

## SND-11's seams (from the code review)
- **Stems**: the tick plays into `sg.stems.*`, `drums` being the existing `sg.drums` (sound.js:1157 drives it). Plain
  gain-1 nodes change only the summing order, far under the tolerance. **No StereoPanner on the `gb` path**: a centred
  panner costs 3 dB. Calls stay through `T.synthVoice` (the tests intercept it there, tracker.test.mjs:164).
- **Patterns**: bass, harmony and drums (tracker.js:494-645) become pure "what plays at this step" functions that both
  paths share; the `gb` code stays as it is, and `gb` is a reserved id (today's code), never data that can drift.
- **Layer ramps** are scheduled at step times, never at `currentTime`: check-sound schedules every bar in one tick with
  the clock moved to the end (check-sound.py:72-74).
- **Schema**: `instruments` and `ensembles` at the top level (`additionalProperties: false` there); new song keys
  (`ensemble`, `trim`) in both `$defs.recipe.properties` and the song's `allOf` list; `$defs.recipe` is open, so a
  `musicFindings` check catches typos in night, tense and arc changes; new enums in `MUSIC_CHOICES`
  (music-studio.test.mjs:41); ensemble ids come from the data.
- **The Studio's mix**: its player (music-editor.js:143-170) uses the default compressor (−24 dB, 12:1) against the
  game's −14 dB, 3:1; both get built from music.json `mix`. Judge the balance on the phone, not in the Studio.
- **Busker**: HB-10d swaps the whole song within 5 m with no hysteresis (sound.js `buskerSongNear`); SND-13 replaces
  that with a stem by distance, simulated until RS-5's busker exists.

## SND-17: jingles and stingers (draft; the owner asked whether the jingles improve too, 2026-10-27)
Today the 12 jingles (music.json `jingles`: victory, levelup, evolve, caught, hatch, motif, relic, reveal, day,
run_won, run_lost, payout_coin) play their notes on one chip lead with a triangle an octave down (`T.jingle`,
tracker.js:667) and duck the song to 0.15. SND-8b moves their echo off the music bus and SND-15 tunes the duck; this
session gives them the new instruments.
1. A jingle may name an `ensemble` and add lines: `harmony` (chords under the tune), `bass` and `perc` (hits by step),
   as note lists like a hook's; the schema in both places and `musicFindings`; `gb` stays today's code.
2. Placeholder arrangements, named as placeholders the owner edits: victory a DS fanfare (the chip lead over brass,
   strings and a timpani roll); levelup a glockenspiel and harp run; evolve a string swell and a harp glissando into
   the reveal; caught a pizzicato and snare-roll fanfare; hatch a music box and celesta; motif the title's first bar
   on chip, harp and strings; relic a sly woodwind run up over pizzicato; reveal two bell notes over a harp; day the
   clock's tock on a woodblock and a soft bell; run_won the victory fanfare into the motif, full; run_lost the victory
   tune backwards in minor on soft strings; payout_coin a chip and glockenspiel coin, a tone higher each row.
3. Stingers: over a song, the short ones (relic, reveal, day, payout_coin) start on the song's next beat and in its key
   where they can, and drop the song's busy stems instead of ducking all of it; the battle fanfares keep the duck.
4. GB Sounds plays today's 8-bit jingles. Cries and UI sounds stay as they are (the chip identity) unless the owner
   asks.
5. The Studio's Jingles card picks the ensemble and edits the new lines; the Sound Test plays every jingle both ways.
6. The 12 jingles' fingerprints written again on purpose, in their own commit (no other fingerprint changes).
Verified by: check-sound (only the jingles change), the full check's "Sound effects and jingles" step, the Studio
check (`--only=music`), the owner's phone.

## Ask me before (Part 2; the first four before SND-8a)
Since the owner's standing instruction (2026-10-27, "How the sessions run"), each session takes the recommended
option below and lists it in its HANDOFF entry under "Decided for the owner, to review"; the owner can change any of
them later.
- WA-8's water sounds move here as SND-10 (recommended), or stay in the water track.
- The music's rain low-pass (2.2 kHz today): soften it to about 4 kHz in SND-8b (recommended; SND-13's rain layer
  then replaces it), keep it, or drop it.
- Levels: lower the internal trims and keep your slider settings (recommended), or lower the sliders' defaults.
- SND-8a: footsteps on the World bus (recommended: they then follow the World slider, not Sound effects), or where
  they are.
- SND-9: bake in setTimeout slices of at most 4 ms first and move to a Worker only if the phone's debug log shows
  hitches (recommended), or a Worker from the start.
- SND-11: the instruments per place (pick them on the listening page).
- SND-12: Claude drafts the arrangements as named placeholders you edit in the Studio (recommended, as in SND-4); a
  loop of 16-32 bars.
- SND-13: the busker plays an instrument stem inside Copperleaf's song as you pass (B2W2) and plays the last run's
  theme only when you stop to listen (recommended), or today's switch within 5 m; what builds a battle's intensity
  (turns, KOs, the red zone, a boss's phases).
- SND-15: the loudness target (−18 LUFS recommended) and the sliders' new defaults; whether sound plays with the
  iPhone's silent switch on (`navigator.audioSession`, iOS 17+; recommended: a setting, off by default).

## Risks
- Claude can't hear: the listening page, the Sound Test, the loudness report and the owner's phone are the checks.
- The fingerprints are mono RMS, each render alone: a change of timbre at the same loudness passes (SND-9 adds
  brightness). They are fragile to the seeded random (one extra `Math.random()` in `initSound` or the tick moves every
  drum hit) and to single-tick scheduling (ramps at step times). Renders run at 44.1 kHz, phones at 48 kHz.
- `--baseline --only=X` rewrites X's whole file: never for a jingle or a cry.
- A main-thread stall over ~115 ms (the 140 ms lookahead minus the 25 ms tick) drops notes: the late-step counter shows
  it. No voice cap on one-shots until SND-8a.
- Phone cost: baked memory, one ConvolverNode, voice counts: budgets in the debug log; the reverb off on the low
  graphics tier if needed. No baking in a frame over 33 ms (the Load track).
- Shared files: sound.js is touched by the hub, water and run tracks; new work goes into `audio/`, `logic/` and data.
- iPhones mute Web Audio with the ring/silent switch: expected; each listening list says so.
- Quick-check steps that assert sound behaviour: Sound settings (slider → bus through a connect wrapper; birds must
  still reach `ambience.amb` or `lpA`), Animals (≥ 9 beds), Sound effects (the beds' duck equals `bedsUnderSong`),
  Debug menu (its section list), Run music (expects `@mid`/`@late`: it changes when the arc becomes layers), the
  40 px targets (the GB Sounds switch).

## Key files
`game/js/audio/tracker.js`, `game/js/sound.js`, `game/js/audio/levels.js`, new `game/js/logic/sound-bake.js`,
`game/data/music.json` and `schema/music.schema.json`, new `game/data/soundscape.json` and its schema (listed in
`game/data/index.json`), `game/js/settings-screen.js` (GB Sounds), `game/js/debug-menu.js` and new `game/js/sound-test.js` (the Sound Test),
`game/js/debug-log.js` (the audio lines), `game/index.html` and `studio/index.html` (the audio script tags),
`studio/js/music-editor.js`, `tools/check-sound.py`, `tools/check-quick.py`, `tools/test/tracker.test.mjs`,
`tools/test/sound.test.mjs`, `tools/after-edit.mjs`, `validation/sound-baseline/`.

## Verification
- Each edit: the after-edit hook (lint, typecheck), then `node --test tools/test/tracker.test.mjs
  tools/test/sound.test.mjs` (the hook skips them for sound.js and tracker.js until SND-8a), or `npm test`.
- Each commit: `python3 tools/check-sound.py` (0 changed, or exactly the planned list; `--loudness` from SND-8a);
  `npm run check:modules` and `npm run check:data` when they apply; `npm run check:smoke`; `python3
  tools/check-quick.py --steps=sound,song,music` (add `"debug menu"` when the menu changes); from SND-11 `python3
  tools/check-studio-github.py --only=music`.
- Session end: `npm run check:quick`, the baseline commit if fingerprints changed, the tag; the owner's phone with the
  session's listening list (remind of the silent switch every time).

## Not in Part 2
Recorded or sampled sound files (the owner: synth only; baked buffers are computed, never loaded); a volume setting
per song (SND-8b's trims are data); voice; haptics.
