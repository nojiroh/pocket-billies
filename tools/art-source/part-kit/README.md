# Part kit sources (phase 16)

The kits' sheets, kept out of the game folder so they never ship: `<kit>-front.png` and `<kit>-back.png`, six
animals as columns on a magenta background, one kind a row, then a row of extras. Each kit's animals, rows and extras
are in `game/data/partKits.json` (`kits`).

To slice a kit (after changing a sheet, or for a new kit): open the Studio, drop both sheets anywhere on it (Art
workbench, Sheet mode, kit rows), check the parts, then **Write** and **Save**. A new kit needs its entry in
partKits.json `kits` first. This replaced tools/slice-part-kit.py (studio track ST-3); the Studio slices the same
way, pixel for pixel (tools/test/sheet-slice-parity.test.mjs).
