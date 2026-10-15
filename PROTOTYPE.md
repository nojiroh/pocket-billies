# GitHub-based UI and graphics proof of concept

Base: Pocket Billies alpha 0.5, commit d6b8441f02bbf588090f120f3273501b9d202f02.

Open `game/prototype.html` through an HTTP server. `game/index.html` remains the original game entry point. The prototype uses the repository's actual assets, game data, WebGL renderer, movement, story, encounters, battle engine, progression, and Studio-compatible asset definitions. It is not the earlier standalone Copperleaf demonstration.

## Try it

- Select **Try prototype · skip opening** on the title to choose one of the real starters and enter Copperleaf. **New game** retains the complete original opening.
- Use **Prototype · Refined** to switch between the original and refined interface and renderer settings on the same save and scene.
- Walk with the game's existing joystick, tap controls, WASD or arrows. The location card fades while moving; the Next up card opens a context-appropriate game action.
- Fight a wild Billie. Move descriptions stay visible. Existing statuses, shield duration, and Focus multiplier are surfaced without changing combat calculations. Tax estimates remain those of the original engine.
- Open Team, inspect a Billie with a split evolution, and select Evolves to see its actual Build/Hype balance.
- Use the existing Graphics settings and graphics gallery to compare quality presets.

## Changes

The refined view uses a system body font, mostly opaque reading surfaces, quieter shadows, and larger battle controls. The graphics layer caps near blur, maximum blur, chromatic aberration, grain, vignette, bloom, ground sheen, surface detail and camera sway. It preserves scene palette, geometry, weather, texture art, and game rules. Original mode bypasses every prototype graphics cap and presentation addition except the comparison controls and save isolation.

Prototype saves use `pocketbillies-prototype-save-v1` and a separate account key. Both account and legacy host cloud initialization are disabled only when the prototype flag is present. Normal game pages retain their existing save key and account behavior. Export/import in the original settings remains available for explicitly transferring a save. This is isolation, not a new cloud conflict-resolution system.

## Scope

This is the first reviewable implementation pass of the improvement plan. It does not replace character or prop artwork, add new financial mechanics, rebalance combat, implement progressive loading, rewrite memory management, or implement cloud-save revision handling. It is intentionally small enough to compare and remove.

## Validation

Run `node tests/prototype.cjs`. Tests load actual game data and verify normal/prototype save separation, prototype account disabling, reversible graphics caps, unchanged unrelated graphics settings, split-evolution calculations, objective generation, preserved title content, script order, and referenced entry assets.

JavaScript syntax and patch whitespace are also checked before publication. Browser-based graphics/layout QA was unavailable in the build environment. The original game's diagnostics and full self-test remain accessible through Settings for device-specific validation. Mobile layout and full-session performance still require hands-on review.
