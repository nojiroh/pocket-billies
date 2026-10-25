// Hub track HB-6: the pasture's post-and-rail fence as parts, made from the rail fence section (fence_wood: a 2.2 m
// section with three posts and two sagging rails, low-poly at 32 px/m), so the parts keep its wood, colours and sizes:
//
//   node tools/make-fence-parts.mjs     # the models in game/art/scene/next/models/, their entries in scenery.json
//
// - fence_post: one of the section's posts with its cap, standing on its base point. Variant 1 is weathered (silvered).
// - fence_rail: the section's two rails, 2 m from post middle to post middle, the rails running into the posts at
//   their middles (mortised), so two rails meeting at a post at an angle never show a seam. It rests on the ground
//   under each end (restEnds: the walk view tips it between two posts on uneven ground). Variant 1 is weathered,
//   variant 2 broken (the top rail snapped, its end down on the grass; the lower rail and the footprint stay, so it
//   still stops you), variant 3 both. A span a little longer or shorter than 2 m takes the rail at that size (s).
// Running it again writes the same files. The section itself stays as it was (other maps place it).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readGameData, ROOT } from './data-files.mjs';

const MODELS = join(ROOT, 'game/art/scene/next/models'),
  section = JSON.parse(readFileSync(join(MODELS, 'fence_wood.json'), 'utf8')),
  post = section.layers.filter(l => l.name === 'post' || l.name === 'post top').slice(0, 2),
  rails = section.layers.filter(l => l.name === 'rail');
if (post.length !== 2 || rails.length !== 2) throw new Error("fence_wood.json's posts and rails aren't as expected");
/** the rail's length (post middle to post middle) and the silvered wood a weathered post or rail takes */
export const FENCE_RAIL = 2;
const r3 = v => Math.round(v * 1000) / 1000,
  SILVER = { '#B27648': '#9C8F7E', '#A06A42': '#8D8274' };

/* the post on its base point, the cap on top */
const postModel = {
  ppm: section.ppm,
  cel: section.cel,
  layers: post.map(l => ({ ...l, x: 0, y: 0 })),
};
/* a rail at the section's height and sag, along x from -L/2 to L/2 through the posts' middles (depth 0) */
const railAt = (rail, L) => {
  const [a, , m] = rail.pts,
    sag = a[2] - m[2];
  return {
    ...rail,
    pts: [-1, -0.5, 0, 0.5, 1].map(f => [r3((f * L) / 2), 0, r3(m[2] + sag * f * f), a[3]]),
  };
};
const [low, top] = [...rails].sort((a, b) => a.pts[0][2] - b.pts[0][2]),
  rail = { ppm: section.ppm, cel: section.cel, layers: [railAt(low, FENCE_RAIL), railAt(top, FENCE_RAIL)] };
/* broken: the top rail snapped a little right of the middle; the left piece still runs into its post, the right piece
   hangs from its post with its broken end down on the grass */
const t = railAt(top, FENCE_RAIL),
  R = t.pts[0][3],
  topH = t.pts[2][2],
  broken = {
    ppm: section.ppm,
    cel: section.cel,
    layers: [
      railAt(low, FENCE_RAIL),
      { ...t, pts: [t.pts[0], t.pts[1], [0.12, 0, r3(topH - 0.01), R]], name: 'rail (broken)' },
      { k: 'cone', x: 0.15, y: 0, z: r3(topH - 0.04), r: 0.04, h: 0.09, sides: 4, col: t.col, tex: t.tex, name: 'splinter', r1: 0.005, rot: 0.4 },
      { ...t, pts: [[r3(FENCE_RAIL / 2), 0, r3(topH + 0.02), R], [0.32, 0.07, r3(R + 0.01), R]], name: 'rail (fallen)' },
    ],
  };
writeFileSync(join(MODELS, 'fence_post.json'), JSON.stringify(postModel));
writeFileSync(join(MODELS, 'fence_rail.json'), JSON.stringify(rail));
writeFileSync(join(MODELS, 'fence_rail_broken.json'), JSON.stringify(broken));

/* the catalogue: the section's look and tags; the pictures (drawn when props aren't drawn as models) are the old
   section's and post's */
const D = readGameData(),
  C = D.scenery.props,
  W = C.fence_wood,
  WP = C.fence_wood_post,
  weathered = { name: 'weathered', swap: SILVER };
C.fence_post = {
  name: 'Fence post (pasture)',
  img: WP.img,
  ox: WP.ox,
  oy: WP.oy,
  shadow: WP.shadow,
  sway: 0,
  flat: 0,
  tags: W.tags,
  group: 'fence_wood',
  solid: WP.solid,
  model: 'scene/next/models/fence_post.json',
  ppm: section.ppm,
  vary: { rot: 0, lean: 0, size: 0.05 },
  variants: [{ ...weathered, name: 'Fence post (weathered)' }],
};
C.fence_rail = {
  name: 'Fence rails (pasture)',
  img: W.img,
  ox: W.ox,
  oy: W.oy,
  shadow: W.shadow,
  sway: 0,
  flat: 0,
  tags: W.tags,
  group: 'fence_wood',
  box: [FENCE_RAIL, W.box[1]],
  restEnds: 1,
  model: 'scene/next/models/fence_rail.json',
  ppm: section.ppm,
  vary: { rot: 0, lean: 0, size: 0 },
  variants: [
    { ...weathered, name: 'Fence rails (weathered)' },
    { name: 'Fence rails (broken)', model: 'scene/next/models/fence_rail_broken.json' },
    { ...weathered, name: 'Fence rails (broken, weathered)', model: 'scene/next/models/fence_rail_broken.json' },
  ],
};
execFileSync('node', [join(ROOT, 'tools/write-data.mjs')], {
  input: JSON.stringify(D),
  stdio: ['pipe', 'inherit', 'inherit'],
});
console.log('fence_post, fence_rail (and broken): models and catalogue entries written');
