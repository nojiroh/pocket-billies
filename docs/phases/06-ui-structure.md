# Phase 06 - UI structure

## Goal
A maintainable, safe UI codebase for a classic RPG: dialogue, menus, battles, shops, the ranch and the robot builder. Players should see no unrelated visual change.

## Verify first
Audit the CURRENT build (alpha 0.5, new look). The reviewer saw alpha 0.4.1: ui.js ~95 KB, ~57 innerHTML uses, five CSS files, shared globals. Verify all of it.

## Tasks
1. Split ui.js into one module per screen (Bag, Team, Guide, Trainer card, Settings, battle menus, shops, dressing room, friends, plus the ranch and robot screens later) with a shared component set (cards, panels, tabs, buttons).
2. Build the dialogue box with a portrait slot (portraits arrive in phase 07) and the text-typing hooks that drive mouth animation.
3. Replace innerHTML string-building with automatically escaped rendering. Recommend one option (a tiny library such as Preact or lit-html, or an escaping template helper) and wait for my decision. Anything showing a friend name, save value or imported data must be escaped by default.
4. Move UI state into one store instead of reading globals.
5. Move colors, spacing, radii and fonts into CSS variables (design tokens). Merge overlapping CSS files. Keep light/dark mode and the wide-screen side panel. Leave room for the retro-futuristic solarpunk look.
6. Reuse the shared components in the Studio's schema-generated forms where sensible.
7. Accessibility basics: focus order, keyboard use, readable sizes, touch target sizes.
8. Add UI tests for the main screens (open, tap, return).

## Ask me before
Adopting any UI library.

## Done when
No innerHTML string-building of untrusted values, UI tests pass, tag `phase-06-done`.

## First reply
Same four items as phase 01.
