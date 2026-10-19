# The city opening: beat sheet (DRAFT, for the owner's approval)

Project Story S7 (docs/phases/project-story.md). Status: **draft, 2026-10-19**. Nothing plays this yet: the set and
these beats are for you to judge and change before S8 builds the scene. Owner decisions it follows: dark rainy neon
at night, only tall buildings (Cyberpunk 2077, Blade Runner), sleek tops over grimy bottoms, pink, cyan and amber
neon, the portal opens in a side alley and is a rift, the player falls through by accident, under 30 seconds,
skippable.

The set: map `city_opening` (tools/build-props-batch8.py; a draft, not joined to the world). One avenue running away
from the camera between towers, the hero tower closing the view, a 5 m alley off to the right two thirds up, the
rift at its end beside the blank logo sign. Walk it on your phone with Settings > Time of day: night, Weather: rain.

## Beats (26 s)

| Time | What you see | Camera (named shot) | Sound |
|---|---|---|---|
| 0-5 s | High over the city at night, rain falling past the lens. The hero needle at the end of the avenue; flying cars cross in two lanes. | `above` easing down to `canyon` | rain, a far city hum, a car passing |
| 5-10 s | Down into the canyon: towers on both sides, neon on every face, the street below wet and lit. | `canyon` to `street` | rain closer, a sign buzzing |
| 10-15 s | Street level. A figure in silhouette walks up the right pavement, lit only by its phone. Who it is stays hidden (you make yourself after the fall). | `street`, following | footsteps, rain on an awning |
| 15-19 s | A low hum. Violet light flickers out of the alley; the figure stops, looks in. | `alleyMouth` | the hum rising, the signs flicker in time |
| 19-24 s | The figure leans in. The rift at the end of the alley widens; the puddles light up violet; the figure stumbles, a cable or a slick step, and tips through. The blank logo sign hangs right beside it (the clue, once S4 names it). | `rift`, then a fast push to `through` | the hum to a roar, then silence |
| 24-26 s | A violet-white flash. The existing fall takes over, from the crust onward. | (fall) | the fall's own sound |

Tap to skip at any point. Shown in full once; skippable at once after that.

## The beats as a script (the story layer's format, docs/SCRIPTS.md)

It parses with today's `parseScript` (logic/script.js); `camera`, `walk`, `face` and `fade` play from S2.

```
camera above
fade in
camera canyon 4.5
camera street 4
walk you walkFrom alleyMouth 4.5
face you sideR
camera alleyMouth 1.5
wait 2
walk you alleyMouth lean 2
camera rift 2
walk you lean stumble 1.5
camera through 1.2
fade out
set seen_city_opening
fall
```

The names after `camera` and `walk` are the set's own: its map holds them in a `cutscene` block (spots: walkFrom,
alleyMouth, lean, stumble, rift, logo; shots: above, canyon, street, alleyMouth, rift, through, each an eye and a
target as [x, height, z] in metres and a field of view; lanes: high and low, the flying cars' paths). The opening in
Sundown keeps its spots in code (cutscene.js CUTSCENE_SPOTS); this is the data shape proposed for both.

## For you to decide

1. **Does this city replace the fall's first leg?** Today the fall opens on a pixel-art street under a billboard
   (opening-fall.js, leg 1). Recommended: yes, the city is that street now; the fall starts at the crust.
2. **How the figure falls in:** a stumble (as above), the rift opening under its feet, or reaching for the light.
3. **Pace:** 26 s as written. The high shot could be cut to 3 s if it drags on the phone.
4. **The billboard tour ad** of the old leg 1 names a singer; it goes with the leg, or to S4's parody fixes.

## What S7-S8 still have to add (not this draft)

- The rift appears on a beat, not always: props with `when` / `unless` (S2's story-dependent world), or a new
  `show` / `hide` command.
- The flying cars move along the lanes; a `seen_city_opening` flag in story.json; the light flicker; the lite
  version for weak phones; frame times in the debug log.
- The organization's logo on the blank sign (S4).
