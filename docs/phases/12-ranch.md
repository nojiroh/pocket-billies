# Phase 12 - Ranch

## Goal
The player has a small ranch in the starting town that they can customize.

## Verify first
- The legacy game has eggs and hatching but no ranch (the README mentions the word only in passing). Check how eggs and the team box work now, since the ranch will hold Billies and breeding.
- Robots are a separate system (phase 17). It is not decided where the robot workshop lives.

## Tasks
1. Design the ranch as a walkable map you can also edit (an edit mode). Propose how customization works on a phone: for example grid or free placement with a decor and building catalog, drag to place, rotate, remove. Ask me.
2. Ranch contents (propose and ask): Billy housing, a nursery for eggs and breeding, training area, garden and decor, power items (solar panels, wind turbines), and possibly the robot workshop bay.
3. Customization: cosmetic items and functional buildings, unlocked by play, with capacity upgrades. Keep the look retro-futuristic solarpunk. Items use the low-poly style from phase 09.
4. Data and saves: ranch layout, items and upgrades in the save with `saveVersion`; validate on load.
5. Ties to other systems: Billies live at the ranch (team box), breeding and hatching happen here (phase 16), robot parts and building may happen at a workshop here (phase 17), friends may visit later (phase 18).
6. Tests: place, move, rotate, remove, persist and reload, capacity limits, phone performance with many items.

## Ask me before
The editing interface; what buildings exist; whether the workshop is part of the ranch.

## Done when
A first customizable ranch exists in the starting town, saves and loads, tag `phase-12-done`.

## First reply
Same four items as phase 01, plus a mock layout of the ranch screen and edit mode.

## Testing (phase 13)
Follow docs/TESTING.md: where new tests go, what must pass before the phase ends, and its section for phase 12.
