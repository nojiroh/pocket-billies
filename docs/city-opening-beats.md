# The city opening: beat sheet (DRAFT, for the owner's approval)

Project Story S7 (docs/phases/project-story.md). Status: **built, 2026-10-19 (cutscene tools, session 3); for the owner to judge on the phone**.
Nothing plays this yet: the set and these beats are for you to judge and change before S8 builds the scene. Owner decisions it follows: dark rainy neon
at night, only tall buildings (Cyberpunk 2077, Blade Runner), sleek tops over grimy bottoms, pink, cyan and amber
neon, the portal opens in a side alley and is a rift, the player falls through by accident, under 30 seconds,
skippable; this street replaces the fall's first leg; the figure reaches toward the light; shorter than the first
draft's 26 s.

The set: map `city_opening` (tools/build-props-batch8.py; a draft, not joined to the world). One avenue running away
from the camera between towers, the hero tower closing the view, a 5 m alley off to the right two thirds up, the
rift at its end beside the blank logo sign. Walk it on your phone with Settings > Time of day: night, Weather: rain.

## Beats (21 s)

| Time | What you see | Camera (named shot) | Sound |
|---|---|---|---|
| 0-3 s | High over the city at night, rain falling past the lens. The hero needle at the end of the avenue; flying cars cross in two lanes. | `above` easing down to `canyon` | rain, a far city hum, a car passing |
| 3-7 s | Down into the canyon: towers on both sides, neon on every face, the street below wet and lit. The billboard opposite the alley shows its advert. | `canyon` to `street` | rain closer, a sign buzzing |
| 7-11 s | Street level. A figure in silhouette walks up the right pavement, lit only by its phone. Who it is stays hidden (you make yourself after the fall). | `street`, following | footsteps, rain on an awning |
| 11-14 s | A low hum. Violet light flickers out of the alley; the figure stops, looks in. | `alleyMouth` | the hum rising, the signs flicker in time |
| 14-19 s | The figure walks in, slowly, toward the light. The rift at the end of the alley breathes; the puddles light up violet. The figure lifts a hand and reaches for it; the light takes the hand, then the rest. The blank logo sign hangs right beside it (the clue, once S4 names it). | `rift`, then a slow push to `through` on the hand | the hum to a roar, then silence |
| 19-21 s | A violet-white flash. The fall takes over, from the crust onward. | (fall) | the fall's own sound |

Tap to skip at any point. Shown in full once; skippable at once after that.

## The beats as a script

The cutscene is `game/data/cutscenes/city.json` (docs/CUTSCENES.md): the set's spots, shots and lanes, its look (night,
rain, whatever Settings say) and this script. New game plays it before the fall, which then starts in the crust.

```
music fall
camera above
actor you at walkFrom up silhouette
hide prop rift
traffic high city_flying_car 9 3
traffic low city_flying_car 7 2
fade in
wait 1
camera canyon 3
wait 3
camera street 3
wait 3
walk you alleyMouth 4
face you sideR
show prop rift
effect sparkle at rift
camera alleyMouth 1
wait 3
camera rift 2
walk you lean 1.5
walk you reach 2
act you reach 2
camera through 1.2
wait 1.5
fade out #F2E8FF
wait 1
```

## Decided (owner, 2026-10-19)

1. **This city replaces the fall's first leg** (the pixel-art street in opening-fall.js). The fall will start at the
   crust. Done in S8, when the city scene plays; until then the old leg stays, so the opening keeps working.
2. **The figure reaches toward the light** and is taken, not a stumble: curious, not clumsy, and still an accident.
3. **Shorter:** 21 s (the high shot 3 s instead of 5, every beat tightened).
4. **The billboard's advert stays open.** The old leg's tour ad leaves with that leg. The set has one ad slot, the
   billboard opposite the alley; what it shows is one picture (`city_billboard_holo.png`), changed by replacing that
   picture or by a variant of `city_billboard` that swaps it. Nothing else depends on it.

## Still to do

- A lite version for weak phones (fewer cars, no rain), and frame times in the debug log, once you've played it.
- The light flicker; a hum and rain sounds (no such sounds yet: the fall's music plays).
- The organization's logo on the blank sign (S4).
- Shown in full once, then skippable at once: today the Skip button works from the start, always.
