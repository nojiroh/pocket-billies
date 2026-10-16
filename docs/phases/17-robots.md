# Phase 17 - Robots (Medabot-inspired, build your own)

## Goal
A second creature system: robots, similar in role to Billies but built by the player from parts and fought with different, more Medabots-like mechanics. Use original names, terms and designs. Prototype first.

## Requirements (from me)
- A robot has: a torso with head, a left arm, a right arm, legs, and a gem that acts as its soul.
- The player can build their own from many parts; it is very customizable.
- Robots fight in battles like Billies, but with their own mechanics, more like Medabots.
- Parts can be upgraded, and are found, crafted or won in trainer battles.

## Tasks
1. Study how the legacy battle engine works and what can be shared with Billy battles (UI, trainers, rewards) versus what must be separate.
2. Design the battle model and present 2-3 options with a recommendation (ASK). Ideas to explore, not rules: each part has its own HP and breaks when depleted; arms provide the actions and may target specific enemy parts; legs and torso drive speed and evasion; an action meter that fills over time; the defeat condition (for example torso or head destroyed, or all key parts). The gem is the soul: it decides personality, learnable techniques, growth or passive traits (ASK how much it matters and whether it ties into the story and the organization).
3. Parts: define stats, abilities, weight or energy cost, rarity, element or type if any, upgrade paths, and cosmetic variants. Propose categories for torso+head, left arm, right arm, legs and gems, and how many to ship in the prototype.
4. Sourcing: found (exploring maps, chests and secrets), crafted (workshop and materials) and won (trainer battles). Trainers also use robots.
5. Builder UI on a phone: slots for the five components, an inventory with comparison, a live 3D assembly preview, paint and colour options, saved loadouts.
6. Art pipeline: modular low-poly parts (airship style, 32 px/m) attached at standard sockets on a skeleton, with palette variants from phase 09. Define the socket standard so any arm fits any torso.
7. Balance: simulation tests that pit thousands of random builds against each other (phase 13) so no single build dominates.
8. Save format and Studio editor (parts, stats, gems, builds).
9. PROTOTYPE FIRST: one chassis family with about 3 torsos, 3 left and 3 right arms, 3 legs and 3 gems, a builder screen and a 1v1 battle. If it is not fun, rethink before scaling.

## Ask me before
The battle model and defeat condition; whether robots and Billies can share a team or battles stay separate; where the workshop lives (ranch or a town); the gem's role; the prototype result before scaling up.

## Done when
Prototype approved, then the full system built with simulation tests inside agreed bounds, tag `phase-17-done`.

## First reply
Same four items as phase 01, plus your 2-3 battle-model options.
