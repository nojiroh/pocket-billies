# The ground tiles (tiles47)

The full-mode ground is `game/art/next/tiles47/<kind>_1.png` to `_12.png`: twelve 32 px tiles (32 px a metre) for each
kind in the catalogue (`scenery.terrains`, `scenery.tileSet` = `tiles47`). **These PNGs are the source.** They are
painted in the Studio: Art browser → `next/tiles47` → **Open as a ground tile set**, or Walk scenes' tile painter →
**Paint the 32 px set** (docs/STUDIO.md, "Ground tile set").

`tools/build-terrain-v47.py` drew the first set and added the catalogue entries. It retired in the Studio art track's
SA-2a (the owner's decision 1, 2026-10-26) so a rebuild can't draw over the painted tiles. It is in the git history
and on the `legacy` branch and tag.

## The twelve tiles' roles
The ground painter (`game/js/walk-view.js` `groundTileRole`) places them:
- 1, 7, 8: plain, over most of the ground, the three equally often and never the same one twice side by side;
- 2-6 and 10: detail, gathered in slow patches;
- 9: the damp patch (in the detail pool);
- 11, 12: worn, along the lines people walk.

Nothing drawn in a tile should cross its edge, and a kind's twelve must all differ (the quick check's Ground step).
The painter never mirrors a tile, so the light keeps to the top left.

## The soft patches and the Lite tiles
The patches of light and shade are not in the tiles: the painter lays them across the ground in world metres
(`groundToneAt`, `applyGroundTone`), scaled by the kind's `tone` (none on paving).

Lite mode draws the 16 px tiles of `game/art/scene/tiles`: a kind's `tile` from its tile 1 and its `vars` (`_1` to `_5`)
from tiles 2-6, with a piece of the patches baked in, then halved. `game/js/logic/lite-tile.js` makes them the way the
builder did (tools/test/lite-tile.test.mjs checks it against the 40 kinds the builder made). The Studio's tile set keeps
them in step as you paint. The 38 older kinds' Lite tiles were drawn by hand at 16 px and stay as they are until
**Make the Lite tiles from this set**.

## A new kind
Not in the Studio yet: add its catalogue entry (`scenery.terrains`) and its twelve tiles and six Lite tiles by hand,
or copy a kind's files and paint them.
