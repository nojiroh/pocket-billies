# Hollow Signal — interactive Pocket Billies UI concept

A **standalone, sample-data UI prototype** designed for mobile portrait first. It does not read or modify game saves, login, Studio, WebGL scene data or gameplay state.

## Direction

Mixed geometric language rather than uniformly angular or uniformly rounded. Navigation uses floating translucent glass, scene cards have expressive asymmetry, party portraits feel soft and organic, and inventory/battle controls have sharper tactile structure. Existing Pocket Billies art, postcard illustrations and fonts are referenced in-place — no copies or generated replacements.

## Try it

From the repository root:

```sh
npm install
npm run dev -- --host
```

Open `http://localhost:5173/game/prototypes/hollow-signal/`. On a phone connected to the same Wi-Fi network, use the network URL printed by Vite, with the same path.

Because the build pipeline copies `game/`, the static prototype can also be opened on a deployed branch using the equivalent `/game/prototypes/hollow-signal/` path, provided that branch's build has been published.

## Interaction walkthrough

1. **Field**: use the round field joystick (tap) to increment simulated exploration moves; claim the journal reward and navigate using quick actions.
2. **Crew**: inspect a Billie or robot; change your lead or heal it with a Tonic.
3. **Bag**: filter items, inspect them, and use medicine.
4. **World**: choose a postcard destination and travel there within the demo; your location updates in the field and header.
5. **Guide**: switch between Billie and robot records and inspect their entries.
6. **Battle**: test attacks, simulated HP, counters, wins, coin rewards, party switching, medicine, retreating and restarting.
7. **Dossier**: top-right menu shows prototype statistics and opens settings.
8. **Settings**: toggle translucent glass, reduce animation, or reset the local demo state. The feedback cue setting is visual-only; no sound is played.

## Intentional limitations

- Visual and interaction mockup only: world visuals are postcard art, not an embedded WebGL game or 3D bowl map.
- No real world travel, accounts, persistence, inventory database, AI opponent or actual battle rules.
- Only the player-facing game interface is prototyped; Pocket Billies Studio remains untouched.
- Portraits and UI art are borrowed from the existing repo and may be replaced or updated before integration.
- Keyboard: Tab to navigate, Escape closes a modal, Up Arrow moves in the field demo.
- Design exploration is isolated at `game/prototypes/hollow-signal/` and should not be merged into game modules until reviewed.

## Next integration decision

After reviewing phone ergonomics, colors, shape variety, glass strength and navigation, decide which components to translate into production styles and screen modules. This prototype deliberately does **not** alter production CSS design tokens or the underlying custom WebGL2 renderer.
