// Load track LD-1: bakes what the game would otherwise read out of pictures' pixels in the page (a stall each time):
// - game/art/scene/next/cuts/<name>.png, every leaf clump cut from its tree's crown picture (a model recipe's picture
//   layer with a clip or a shade), named by logic/pixel-facts.js leafCutName of its key;
// - game/data/pixelFacts.json: { lightness: { <picture>: mean lightness } } for the flat grass props (scenery
//   groundTint) and { cuts: { <key>: <baked cut's art path> } }.
// Made with the game's own maths (game/js/logic/pixel-facts.js), so a baked cut is the cut the page would make.
//
//   node tools/bake-pixel-facts.mjs           # bake (npm run bake:pixels); writes only what changed, deletes stale cuts
//   node tools/bake-pixel-facts.mjs --check   # fail when a baked fact or cut is missing, stale or left over
//
// Run it after painting a tree's crown, moving a clump (a recipe's clip) or painting a moss or clover picture; the
// unit test tools/test/pixel-facts-real.test.mjs runs the check.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, ROOT } from './data-files.mjs';
import { encodePng, readPng } from './test/png.mjs';
import {
  leafCutKey,
  leafCutName,
  leafCutPixels,
  leafOutlineColour,
  pixelLightness,
} from '../game/js/logic/pixel-facts.js';

const ART = join(ROOT, 'game', 'art');
const MODELS = join(ART, 'scene', 'next', 'models');
export const CUTS = 'scene/next/cuts';
const FACTS = join(DATA, 'pixelFacts.json');

/** every picture layer with a clip or a shade in the model recipes: { key, img, L } */
function leafLayers() {
  const out = new Map();
  for (const f of readdirSync(MODELS).sort()) {
    if (!f.endsWith('.json')) continue;
    const walk = o => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        if (o.k === 'img' && o.img && (o.clip || o.shade)) {
          const key = leafCutKey(o.img, o);
          if (!out.has(key)) out.set(key, { key, img: o.img, L: { clip: o.clip, shade: o.shade } });
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(JSON.parse(readFileSync(join(MODELS, f), 'utf8')));
  }
  return [...out.values()];
}

/** every picture a flat grass prop (scenery groundTint) can show: its own and its variants' */
function groundTintPictures() {
  const props = JSON.parse(readFileSync(join(DATA, 'scenery.json'), 'utf8')).props,
    out = new Set();
  for (const M of Object.values(props)) {
    if (!M.groundTint) continue;
    const walk = o => {
      if (typeof o === 'string' && o.endsWith('.png')) out.add(o);
      else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(M);
  }
  return [...out].sort();
}

/** what the bake makes: the facts file's text and the cuts' pictures (art path -> { width, height, data }) */
export function bakePixelFacts() {
  const pics = new Map(),
    read = p => {
      if (!pics.has(p)) {
        const P = readPng(join(ART, p));
        pics.set(p, { ...P, outline: null });
      }
      return pics.get(p);
    };
  const lightness = {};
  for (const p of groundTintPictures())
    if (existsSync(join(ART, p))) lightness[p] = Math.round(pixelLightness(read(p).data) * 1e6) / 1e6;
  const cuts = {},
    files = new Map();
  for (const { key, img, L } of leafLayers().sort((a, b) => (a.key < b.key ? -1 : 1))) {
    if (!existsSync(join(ART, img))) continue;
    const P = read(img);
    if (!P.outline) P.outline = leafOutlineColour(P.data);
    const c = leafCutPixels(P.width, P.height, P.data, P.outline, L),
      path = `${CUTS}/${leafCutName(key)}.png`;
    cuts[key] = path;
    files.set(path, { width: c.w, height: c.h, data: c.data });
  }
  const text = JSON.stringify({ lightness, cuts }, null, 1) + '\n';
  return { text, files };
}

const samePixels = (a, b) =>
  a.width === b.width &&
  a.height === b.height &&
  a.data.length === b.data.length &&
  a.data.every((v, i) => v === b.data[i]);

/** the differences between the bake and what's on disk (empty: up to date); with write, they are fixed */
export function pixelFactsDiff(write = false) {
  const { text, files } = bakePixelFacts(),
    out = [];
  if (!existsSync(FACTS) || readFileSync(FACTS, 'utf8') !== text) {
    out.push('game/data/pixelFacts.json');
    if (write) writeFileSync(FACTS, text);
  }
  const dir = join(ART, CUTS);
  if (write) mkdirSync(dir, { recursive: true });
  for (const [path, img] of files) {
    const f = join(ART, path);
    if (existsSync(f) && samePixels(readPng(f), img)) continue;
    out.push('game/art/' + path);
    if (write) writeFileSync(f, encodePng(img));
  }
  const want = new Set([...files.keys()].map(p => p.split('/').pop()));
  for (const f of existsSync(dir) ? readdirSync(dir) : [])
    if (!want.has(f)) {
      out.push(`game/art/${CUTS}/${f} (left over)`);
      if (write) rmSync(join(dir, f));
    }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check'),
    d = pixelFactsDiff(!check);
  if (check && d.length) {
    console.error(`pixel facts out of date (npm run bake:pixels):\n  ${d.join('\n  ')}`);
    process.exit(1);
  }
  console.log(d.length ? `baked: ${d.length} file(s)` : 'pixel facts up to date');
}
