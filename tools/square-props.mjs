// Hub track HB-10: Copperleaf's town square, shared by tools/patch-copperleaf-square.mjs, tools/build-copperleaf.mjs
// and the test: its shape (HB-10a) and what stands round its edge (HB-10b: Gehl, people stop at a square's edges and its
// middle fills last), laid by angle round the square's middle and an inset from its rim. Every edge prop carries
// `sq: 1`; laying again removes those first.
//
// The market faces you from the north rim (the walk camera looks north), between the lab and the library; planters
// flank the three streets where they come in (east, north-west, south-west); lamps round the rim; benches facing the
// fountain; a solar canopy on the south-east; after a won run, bunting and flags (HB-10d). Kept clear: the view
// toward the sky rail and the portal (VIEW), a walk round the fountain (nothing nearer its middle than WALK_R), the
// hub spot.

const r2 = v => Math.round(v * 100) / 100;

export const SQUARE_R = 10; /* the square's mean radius (m) */

/** the square's rim, metres from its middle at angle a (radians, 0 east, 90 degrees north): a bulge toward the
 * north-east (the sky rail and the portal), three soft lobes and a little wobble, kept between 8.2 and 11.8 m */
export const squareRim = a =>
  Math.max(
    8.2,
    Math.min(11.8, SQUARE_R + 1.2 * Math.cos(a - 0.6) + 0.6 * Math.sin(3 * a + 0.9) + 0.3 * Math.sin(7 * a + 2.3))
  );

/* HB-10b: the hub's spot (where you start and land), from the square's middle. The island's orbit camera points the
   stick's up toward its middle (cam.orbit.c, to the north-west), so from here a push up runs past the fountain (it
   stands 2.7 m ahead, to the left), not into its basin; HB-10a's spot 1.25 m from the basin ran into it */
export const HUB_OFF = [3.75, 1.5];

/** the hub's spot for a map whose square's middle is the well plot */
export const squareHubSpot = M => {
  const well = M.plots.find(L => L.k === 'well');
  return [r2(well.x + HUB_OFF[0]), r2(well.z + HUB_OFF[1])];
};

/** the map with its hub moved to `to`: every walking check that started at the old spot starts there too */
export function moveHub(M, to) {
  const was = M.hub;
  M.hub = to;
  for (const c of M.checks || []) if (c.from && c.from[0] === was[0] && c.from[1] === was[1]) c.from = [...to];
  return M;
}

/* HB-10d: the fountain's look per chapter (the owner: Chapter 1 as built; from Chapter 2 the portal tear's violet, a
   crack up its top bowl, a Bureau plaque; tools/build-props-square.py): each look a fountain of its own on the same
   spot, shown while its chapter holds (`when` / `unless`, the story's `chapter` condition), so the square changes the
   moment the story moves on. A later chapter adds a row and narrows the one before. */
export const FOUNTAIN_LOOKS = [
  ['fountain', { unless: 'chapter >= 2' }],
  ['fountain_ch2', { when: 'chapter >= 2' }],
];

/* HB-10d: a tap on the fountain tosses a coin (game/js/town-square.js, logic/fountain-wish.js) */
export const FOUNTAIN_ACT = { act: 'wish', label: 'Fountain' };

/** the map's props with the fountain's looks on the fountain's spot (the first look is the fountain itself; the
 * others are laid again), each tapped to toss a coin */
export function fountainLooks(M) {
  const F = M.props.find(p => p.k === FOUNTAIN_LOOKS[0][0] && !p.dress);
  if (!F) throw new Error('no fountain on the map');
  const later = FOUNTAIN_LOOKS.slice(1).map(([k]) => k),
    out = M.props.filter(p => !later.includes(p.k));
  delete F.when;
  delete F.unless;
  Object.assign(F, FOUNTAIN_ACT, FOUNTAIN_LOOKS[0][1]);
  const at = out.indexOf(F);
  out.splice(at + 1, 0, ...FOUNTAIN_LOOKS.slice(1).map(([k, c]) => ({ k, x: F.x, z: F.z, ...FOUNTAIN_ACT, ...c })));
  return out;
}

export const WALK_R = 4.6; /* nothing stands nearer the square's middle than this (m) */
export const VIEW = [15, 45]; /* degrees round the square kept low toward the portal */
/* [kind, degrees round the middle (0 east, 90 north), metres in from the rim, 'in' (its front to the fountain) or a
   rot] */
/** HB-10c: Copperleaf's folk (the map's `folk`): 10, the most drawn at once (the Engine's quality.townFolk) */
export const SQUARE_FOLK = 10;

/* HB-10e: the festivals' decorations (festivals.json), on grass just outside the rim like the win bunting, each shown
   while one of its festivals is on (`when: festival:<id> or ...`). Only one festival is on at a time, so they share
   spots: FESTIVAL_SPOTS, [degrees, metres in from the rim], each clear of the edge props, the stops, the bunting and
   the streets' mouths (hub-square.test.mjs); a pennant line across the south rim for every festival but a market day */
export const FESTIVAL_SPOTS = {
  a: [-56, -1.5],
  b: [-32, -2.5],
  c: [52, -1.5],
  d: [-112, -1.5],
  e: [124, -1.5],
  f: [-140, -1.5],
};
const FESTIVALS_ALL = ['homecoming', 'tenth_departure', 'sprout_fair', 'longest_light', 'spire_supper', 'lantern_walk'];
/* [kind, spot (a key of FESTIVAL_SPOTS, or [degrees, inset]), the festivals it is up for] */
export const FESTIVAL_DRESS = [
  ['pennant_line', [-88, -1.5], FESTIVALS_ALL],
  /* the Sprout Fair: the seed swap */
  ['seed_library_box', 'a', ['sprout_fair']],
  ['veg_patch_frame', 'b', ['sprout_fair']],
  ['beehive', 'c', ['sprout_fair']],
  ['flowerpot', 'd', ['sprout_fair']],
  ['veg_patch_frame', 'e', ['sprout_fair']],
  /* Longest Light: solar lights and a turbine */
  ['solar_post_light', 'a', ['longest_light']],
  ['wind_turbine_small', 'b', ['longest_light']],
  ['solar_post_light', 'c', ['longest_light']],
  ['flag_pole', 'd', ['longest_light']],
  ['solar_post_light', 'e', ['longest_light']],
  ['flag_pole', 'f', ['longest_light']],
  /* the Spire Supper: the harvest */
  ['haystack', 'a', ['spire_supper']],
  ['hay_round', 'b', ['spire_supper']],
  ['crate_goods', 'c', ['spire_supper']],
  ['barrel_wood', 'd', ['spire_supper']],
  ['haybale_stack', 'e', ['spire_supper']],
  ['firewood', 'f', ['spire_supper']],
  /* the Lantern Walk: lanterns all round */
  ...['a', 'b', 'c', 'd', 'e', 'f'].map(k => ['lantern', k, ['lantern_walk']]),
  /* the milestones: flags */
  ['flag_pole', 'a', ['homecoming', 'tenth_departure']],
  ['flag_pole', 'd', ['homecoming', 'tenth_departure']],
  ['flag_pole', 'f', ['homecoming', 'tenth_departure']],
  ['flag_pole', 'c', ['tenth_departure']],
  /* a market day: more goods out */
  ['crate_goods', 'a', ['market_day']],
  ['sack', 'd', ['market_day']],
  ['barrel_wood', 'e', ['market_day']],
];
/** FESTIVAL_DRESS as SQUARE_EDGE rows: [kind, degrees, inset, 'in', { when }] */
export function festivalDress() {
  return FESTIVAL_DRESS.map(([k, at, ids]) => {
    const [deg, inset] = typeof at === 'string' ? FESTIVAL_SPOTS[at] : at;
    return [k, deg, inset, 'in', { when: ids.map(id => 'festival:' + id).join(' or ') }];
  });
}

export const SQUARE_EDGE = [
  /* the market on the north rim */
  ['market_cart', 58, 1.3, 'in'],
  ['stall', 80, 1.6, 'in'],
  ['crate_goods', 92, 0.9, 'in'],
  /* HB-10e: the middle stall keeps the festival market (game/js/town-square.js festivalMarketOpen) */
  ['stall', 104, 1.6, 'in', { act: 'fest', label: 'Middle stall' }],
  ['sack', 116, 0.9, 'in'],
  ['stall', 128, 1.6, 'in'],
  ['barrel_wood', 139, 0.9, 'in'],
  /* planters either side of each street's mouth */
  ['planter_round', -14, 0.8, 'in'],
  ['planter_round', 27, 0.8, 'in'],
  ['planter_round', 145, 0.8, 'in'],
  ['planter_round', 167, 0.8, 'in'],
  ['planter_round', -148, 0.8, 'in'],
  ['planter_round', -180, 0.8, 'in'],
  /* lamps round the rim */
  ['streetlamp', 48, 0.6, 'in'],
  ['streetlamp', 142, 0.6, 'in'],
  ['streetlamp', -40, 0.6, 'in'],
  ['streetlamp', -100, 0.6, 'in'],
  ['streetlamp', -152, 0.6, 'in'],
  /* string lights (tools/build-props-square.py): in front of the market, over the south-west benches */
  ['string_lights', 104, 3.0, 'in'],
  ['string_lights', -125, 2.4, 'in'],
  /* somewhere to sit */
  ['solar_canopy', -68, 1.0, 'in'],
  ['bench_wood', -25, 1.0, 'in'],
  ['bench_wood', -122, 1.0, 'in'],
  ['bench_wood', 192, 1.1, 'in'],
  /* HB-10d: the town's notice board on the south rim, between the canopy and a lamp (the one gap clear of every edge
     prop and stop off the streets' mouths): the town's news, your favours, the fountain (game/js/town-square.js) */
  ['notice_board', -84, 0.9, 'in', { act: 'hubnotice', label: 'Notice board' }],
  /* HB-10d: the busker's slot (logic/square-day.js `busk`), an open case 3.5 m in from the south-east rim, clear of
     the stops and of the stick's run from the hub */
  ['busker_case', -54, 3.5, 'in'],
  /* HB-10d: the win bunting, up only after a won run (`when`: logic/run-history.js historyFacts), on grass just
     outside the rim: pennant lines across the east street's mouth and behind the market, the town's flag on two poles
     either side of the market; each 1.8 m or more from every edge prop and stop (logic/square-day.js) */
  ['pennant_line', 6, -0.6, 'in', { when: 'last:won' }],
  ['pennant_line', 100, -0.6, 'in', { when: 'last:won' }],
  ['flag_pole', 70, -0.6, 'in', { when: 'last:won' }],
  ['flag_pole', 160, -0.6, 'in', { when: 'last:won' }],
  /* HB-10e: the festivals' decorations (FESTIVAL_DRESS, below) */
  ...festivalDress(),
];

/** the edge props for a map whose square's middle is the well plot: the map's props without the old ones, then the
 * new ones */
export function squareEdgeProps(M) {
  const well = M.plots.find(L => L.k === 'well'),
    out = [];
  for (const [k, deg, inset, face, more] of SQUARE_EDGE) {
    const a = (deg * Math.PI) / 180,
      r = squareRim(a) - inset,
      /* rot 0 faces south; facing the middle (degrees deg + 180) is rot deg + 270 (logic/prop-turn.js) */
      rot = face === 'in' ? ((((deg + 270) % 360) + 540) % 360) - 180 : face;
    out.push({
      k,
      x: r2(well.x + Math.cos(a) * r),
      z: r2(well.z + Math.sin(a) * r),
      ...(rot ? { rot } : {}),
      ...more,
      sq: 1,
    });
  }
  return [...M.props.filter(p => !p.sq), ...out];
}
