# Phase 16 - Billies (monster system) (design first, prototype before scaling)

## Goal
A mix of Spore-style creation and Pokemon-style named species, with funny "abominations". Phase 13's breeding unit tests and simulation must exist first. Robots are a separate system (phase 17); keep Billies and robots clearly distinct.

## Verify first
- 117 species in 58 lines; each creature is ~20 puppet pieces on a skeleton with body-plan templates (quad, biped, bird, fish and others) and a Golden recolor. The rig system (rig.js, tools/build-roster-sheets.py) is the base to extend.

## Tasks
1. Slim the roster to about 30-40 hand-designed named species with lore, types and roles. Reuse existing rig and sheet art where possible.
2. Build individuals from swappable parts (head, torso, limbs, tail, markings, palette) on the existing rig system, with small readable stat quirks.
3. Add breeding. Ask me whether it should be deliberate (pick parents), partly random (daycare surprises) or both; recommend one.
4. Add abominations: crossing distant species or body plans gives chimeras with a satirical merger-style name (for example "Cartokid Holdings"), a stat spike and a drawback (for example it taxes itself, files for bankruptcy mid-battle, or hedges instead of attacking). Keep them rare, cap the weirdness, keep function readable (wings mean flying, horns mean attack), and cap stat variance to prevent degenerate combos.
5. Let players share or trade their best abominations through the friends system (build after phase 18 is designed).
6. Breeding and hatching happen at the ranch (phase 12). Add more diversity through breeding and random encounters: encounter tables (phase 08) can produce Billies with varied parts, rarities and quirks, within the readability and balance caps above.
7. Add a Studio section for part libraries and breeding rules.
8. PROTOTYPE FIRST: one quadruped body plan, about 10 swappable parts and one breed function. If a first abomination does not make us laugh, rethink before scaling.

## Ask me before
The final roster list; the breeding mode; the prototype's result before scaling up.

## Done when
Prototype approved, then the full system built, simulation tests within bounds, Studio section in place, tag `phase-16-done`.

## First reply
Same four items as phase 01, plus a proposed slimmed roster list.
