# CC0 sources for the GLB-to-recipe converter (route props track RP-3)

The models tools/glb-to-recipe.py converts for the converter test (docs/phases/route-props-track.md, RP-3). Only
CC0 files: each one's licence was read in its pack's own `LICENSE.txt` before it was copied here. They are inputs for
the tool, not game art: the game draws the recipes made from them (game/art/scene/next/models/*_cc0.json).

All three packs are by Kay Lousberg (KayKit, www.kaylousberg.com), downloaded 2026-10-26 from KayKit's own GitHub
repositories (raw.githubusercontent.com; this container can't reach kaylousberg.com or itch.io). Each pack's
`LICENSE.txt` says:

> License: (Creative Commons Zero, CC0)
> http://creativecommons.org/publicdomain/zero/1.0/
> This content is free to use in personal, educational and commercial projects.
> Support me by crediting Kay Lousberg, www.kaylousberg.com (this is not mandatory)

and each README: "Licensed under CC0 1.0 Universal". Credit is not required; we give it here anyway.

| File | Pack | Repository @ commit | Path in the repository | Converted to |
|---|---|---|---|---|
| windturbine_tall.gltf, windturbine_tall.bin | KayKit Space Base Bits 1.0 | github.com/KayKit-Game-Assets/KayKit-Space-Base-Bits-1.0 @ 6dfbcac9927d06283752c4defd4882cfe0d29666 | addons/kaykit_space_base_bits/Assets/gltf/ | wind_turbine_small_cc0 |
| spacebits_texture.png | KayKit Space Base Bits 1.0 | (as above) | addons/kaykit_space_base_bits/Assets/gltf/ | its colours |
| arch.gltf, arch.bin | KayKit Halloween Bits 1.0 | github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0 @ 6dc69bf6b2fa766a985754f35ec6a0324090e6c6 | addons/kaykit_halloween_bits/Assets/gltf/ | arch_ruin_cc0 |
| halloweenbits_texture.png | KayKit Halloween Bits 1.0 | (as above) | addons/kaykit_halloween_bits/Assets/gltf/ | its colours |
| building_bridge_A.gltf, building_bridge_A.bin | KayKit Medieval Hexagon Pack 1.0 | github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 @ 84fa4e91af6a88989be7c99e0891cede11f2ca38 | addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/neutral/ | footbridge_wood_cc0 |
| hexagons_medieval.png | KayKit Medieval Hexagon Pack 1.0 | (as above) | addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/neutral/ | its colours |

Checked and not used: Kenney's GitHub starter kits (Starter-Kit-City-Builder, -3D-Platformer, -Racing, -FPS,
-Basic-Scene). Their repositories' licence files are MIT, not CC0, and they have no turbine, bridge or arch.

Adding a file: CC0 only. Read the licence in the pack itself (not a mirror's word for it), copy the file unchanged,
and add a row here.

## The characters track's stand-in (CH-3)

The figure baker's stand-in, game/art/figures/rogue.json and rogue.png, is made by tools/gltf-figure.mjs from
KayKit's Rogue (KayKit : Adventurers Character Pack 1.0, by Kay Lousberg), downloaded 2026-10-27 with a shallow
`git clone` of github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 @
672074b73ba276876a19e8816ecdc5241817ab47, path addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb.
Its `LICENSE.txt` (and the copy in addons/kaykit_character_pack_adventures/) says:

> License: (Creative Commons Zero, CC0)
> http://creativecommons.org/publicdomain/zero/1.0/
> This content is free to use in personal, educational and commercial projects.
> Support me by using a brand resource provided in this pack or by crediting Kay Lousberg, www.kaylousberg.com (this
> is not mandatory)

and its README: "Licensed under CC0 1.0 Universal". The .glb (3.6 MB, most of it the pack's 76 clips) is not copied
here: to make the figure again, clone the pack at that commit and run
`node tools/gltf-figure.mjs <the pack>/addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb rogue`
(its body, head and cape; the knives and crossbows in its hands left out; the clips Idle, Walking_A, Running_A, Cheer,
Throw and Sit_Chair_Idle). The pack's Knight, Mage, Barbarian and Rogue_Hooded are CC0 too and go through the same
tool.
