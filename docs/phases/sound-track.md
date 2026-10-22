# Sound track (SND) - a Pokémon-style soundtrack, cries, and a Studio section for them

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
  **Footsteps** by terrain every 0.33 m on a 50 ms poller. **One tick** on every button.
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
| SND-5 (done 2026-10-22) | Battle and run music | intros timed to the throw, wild/trainer/leader/boss/rival/ghost, biome × row variants, the deadline variant, the red zone | SND-4, RL-8 | 1-2 | battle fixture; run fixture; phone |
| SND-6 | Sound effects and jingles | a cry per species with a low-HP cry, four UI sounds, jingles for the run's beats, a mix pass | SND-4, RL-12 for relics | 1 | battle golden record untouched; phone |

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
- The order of SND-4 to SND-6 after the play test, and whether any of them should go before it.

## Not in this track
Recorded or sampled sound files (the game stays synthesized: no assets, no loading, no licensing); a music volume
per song; voice; haptics beyond what exists; the step counter's sounds (removed with it).
