// Map generator MG-2: the golden scenes. Five unjoined routes on the game's own data (the default dials, water, three
// exits, a feature, terraces), written down as a hash per part (ground, heights, steps, props, exits and hub, the
// rest), so a change to what the generator makes shows at once and says which part moved. `gen` is left out: it
// holds the dials and the version, which change when dials are added. Taken before MG-2 changed the generator; a
// change meant to alter these scenes remakes it, said in the commit:
//   node --test --test-update-snapshots tools/test/mapgen-golden.test.mjs
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen,
  { hashString } = modules.rng,
  ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes };

const SCENES = {
  default: { seed: 4242 },
  water: { seed: 7, biome: 'lake', land: { water: 'stream', waterAmount: 0.6 }, road: { shape: 'scurve' } },
  threeExits: {
    seed: 11,
    road: {
      exits: [
        { side: 'W', t: 0.4 },
        { side: 'E', t: 0.6 },
        { side: 'S', t: 0.5 },
      ],
      shape: 'switchback',
    },
  },
  feature: { seed: 23, biome: 'thicket', feature: 'glade', land: { water: 'pond', hills: 0.7 } },
  terraced: {
    seed: 31,
    biome: 'ridge',
    land: { terraces: 0.7, cliffs: 0.6 },
    road: {
      exits: [
        { side: 'S', t: 0.5 },
        { side: 'N', t: 0.25 },
        { side: 'N', t: 0.75 },
      ],
    },
  },
  /* RT-1: a run route laid out as a forest trail (forest masses, deep forest ground, spots, sc.layout) */
  laidOut: { seed: 41, biome: 'meadow', layout: 'forest', pin: 'EW' },
};

const hash = v => hashString(JSON.stringify(v ?? null));
function parts(sc) {
  const { tiles, heights, steps, stepm, props, edgeExits, exits, hub, gen, ...rest } = sc;
  void gen;
  return {
    tiles: hash(tiles),
    heights: hash(heights),
    steps: hash([steps, stepm]),
    props: hash(props),
    exits: hash([edgeExits, exits, hub]),
    rest: hash(rest),
    counts: { props: props.length, raised: !!steps },
  };
}

for (const [name, params] of Object.entries(SCENES))
  test(`golden scene: ${name}`, t => {
    t.assert.snapshot(parts(G.mapgenScene(params, ctx).scene));
  });
