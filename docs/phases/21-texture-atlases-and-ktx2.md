# Phase 21 - Texture atlases and KTX2 compression

## Goal
Pack the world's pictures into atlas pages and ship them as GPU-compressed KTX2 (Basis Universal) textures, so a place
needs few texture binds (phase 20's instancing groups by page) and far less GPU memory on phones. Source PNGs stay the
thing people edit; atlases and KTX2 files are built from them.

## Decided (owner, 2026-10-19)
- Atlases and KTX2 now, not later.
- After phase 20. Measured by the owner on their own devices.

## What the game has today (read 2026-10-19, verify again before starting)
- About 2,967 PNG and 17 WebP pictures. Each world picture is its own texture, looked up through a WeakMap
  (webgl.js 576-632), RGBA8, mipmapped with anisotropic filtering.
- Rig pictures are atlases already, cut out on a 2D canvas (skeleton-rig.js 468-471).
- Normal maps are made at run time from each picture's alpha and brightness in a worker (webgl.js 661-787), with a
  second copy of that code on the main thread (788-856). This needs the decoded pixels.
- The texture budget is an LRU by estimated bytes: 128 MB on phones, 384 MB elsewhere (webgl.js 1026-1060).
- The Studio edits pictures and opens pull requests; `sw.js` caches art cache-first.

## Design

### 1. Atlas build
- `tools/build-atlases.mjs` packs world pictures into pages of at most 2048 × 2048, grouped by where they are used
  (a shared page set for common props, then per region), so a place loads few pages. Each picture gets padding with
  its edge pixels repeated (no bleeding at a distance with mipmaps).
- Output: `game/art/atlas/<page>.png` (and `.ktx2`, below) plus a manifest from each picture key to page and
  rectangle. The game looks pictures up through the manifest; a picture not in any page loads alone as today.
- Generated, not in git; built by `npm run data`/the build and in CI, like `gamedata.js`. In `npm run dev` the game
  can use single pictures, so a Studio edit shows at once.
- Alternative studied in phase 20: a texture array (TEXTURE_2D_ARRAY) per size bucket instead of 2D packing. No
  packing or bleeding, and each picture keeps its pixel coordinates, but Copperleaf would waste about 2.5x memory
  (5 buckets, 4.67 Mpx for 1.89 Mpx of pictures), layers must be preallocated, and mipmaps are rebuilt for the whole
  array on every upload. Choose between the two in the first reply, with numbers.
- **Ask me before:** what is excluded (portraits, UI, pictures the Studio paints often).

### 2. KTX2 encoding
- Encode pages with Basis Universal (`basisu` or KTX-Software's `toktx`) in the build. Two modes: UASTC (high
  quality, larger) and ETC1S (small, blurrier).
- Pixel art at 32 px/m suffers from block compression (blocks are 4×4 pixels, so single-pixel details smear). Plan:
  UASTC with mipmaps for props and terrain; anything that looks wrong stays PNG. The owner compares on the phone.
- Transcoding in the browser: the Basis WebAssembly transcoder in a worker, picking the best format the GPU offers
  (ASTC on most phones, ETC2 as the WebGL 2 baseline, BC7/S3TC on desktops), RGBA8 as a last resort. The transcoder
  is a few hundred KB; the service worker caches it and the `.ktx2` files.
- If the transcoder fails, the game falls back to the PNG pages.

### 3. Normal maps at build time
A compressed texture can't be read back to make normal maps. Move the normal-map code into the build (one copy,
removing the worker/main-thread duplicate): the build writes a normal-map page next to each atlas page, compressed
the same way. In dev, single pictures keep the run-time path. Where the guess from brightness is wrong, an artist
can add an optional height picture next to the original; the manifest stores a normal strength per picture.

### 4. Memory budget
The budget counts compressed sizes (and, from phase 20, render targets and meshes). The debug log reports texture MB
by kind.

## Tasks
1. Atlas packer, manifest and lookup; dev mode keeps single pictures. Data check: every picture key resolves.
2. Phase 20's instancing groups by atlas page.
3. Normal maps built per page (task 3 of the design); remove the duplicate code.
4. KTX2 encoding in the build and CI (UASTC first), with PNG fallback.
5. Transcoder worker and format choice; service worker caching.
6. Memory accounting by kind in the debug log.
7. The owner runs the graphics test on their phone: frame rate, load time, texture MB, and a look at pixel-art
   quality, before and after. Pictures that look worse go back to PNG (a list in the build config).

## Ask me before
- What stays out of the atlases (task 1).
- UASTC vs ETC1S per kind of picture, after seeing them on the phone.
- How big a build-time increase is acceptable in CI.

## Done when
All tiers pass; the game and the Studio work in dev and in the build; the owner's phone shows lower texture memory
and no worse frame rate or look; the PNG fallback works when the transcoder is blocked; HANDOFF updated; tag
`phase-21-done`.

## First reply
A plan in Plan Mode: the packing groups, the encoder and settings, and anything here the code proves wrong.

## Testing (phase 13)
Follow docs/TESTING.md. Picture quality is judged by the owner on their devices, not by headless pixel differences.
