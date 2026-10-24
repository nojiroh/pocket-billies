# Editing trainer sprites

Trainer art spans three distinct systems. The exporter collects all three **from the checked-out repository** without resizing or redrawing any pixels:

1. `game/art/trainer/`: modular body and wardrobe atlases, individually split using the exact rig piece rectangles in `game/data/gamedata.js`. All recolor masks are exported to matching `_mask.png` sheets.
2. `game/art/people/`: existing player/NPC trainer front, back and walking frames.
3. `game/art/next/portraits/`: all portrait layers, sorted into heads, bodies, eyes, brows, mouths, noses, hair, hats, clothes and accessories.

## Download the full current-repository edit pack

The [**Trainer Editable Sprite Sheets** workflow](../../actions/workflows/trainer-sprite-sheets.yml) publishes a ZIP artifact named **trainer-sprite-edit-pack**. It includes the editable sheets, guides, JSON manifest, exact source PNG backups and, where available, the original unsliced portrait kit.

The **`art-edit/trainer-sheets/`** directory in the export branch also contains the generated PNG sheets, guides and manifest (without redundant source backups). Use the workflow artifact when importing edits, as it includes the original source PNGs.

## Edit with Aseprite, LibreSprite, Krita, or Photoshop

- Open files under `sheets/` and switch off filtering/interpolation. They contain actual transparent pixels, not screenshots or scaled previews.
- Each sprite occupies one fixed, rectangular **cell**. Look up its `sheet` and `cell` rectangle in `manifest.json`. Every entry in a given sheet uses the same grid cell dimensions; e.g. set the Aseprite grid size to that cell's width × height.
- The `guides/` images are only for finding parts: they show labels and 2× previews. **Do not paint on guides.**
- Clothing consists of *rig pieces* (front/back/side and separate bones), not a flattened finished trainer.
- To change palette/recolor regions, edit the correspondingly numbered `_mask.png`. Its pixels occupy exactly the same sheet-cell rectangles as the color sheet.
- Keep **sheet dimensions, cell order, transparency, and pixel scale** the same. To import changes into the game's existing atlases without changing rig metadata, edits must stay inside the **original source rectangle**, which is given by each manifest entry's `rect`. Pixels added beyond this rectangle are ignored on reimport.

## Restore sheets to the game's file format

Work inside the repository root after downloading/unzipping the **full** workflow artifact so that `art-edit/trainer-sheets/manifest.json` and `art-edit/trainer-sheets/originals/` exist.

```sh
python -m pip install Pillow
python tools/export-trainer-sprite-sheets.py --reimport art-edit/trainer-sheets --out art-edit/edited-assets
```

This reconstructs all individual source PNGs in `art-edit/edited-assets/game/art/`, including the wardrobe packed atlases and mask files. Nothing under `game/art/` is overwritten automatically. Compare the changes, copy only desired rebuilt assets to the original paths, and reload the game/Studio.

Export your own fresh set any time:

```sh
python tools/export-trainer-sprite-sheets.py --root . --out art-edit/trainer-sheets
```

The workflow checks an **unmodified** export/reimport round trip for pixel-for-pixel equality against all source PNGs. This does not validate the appearance of any subsequent hand-edited art.
