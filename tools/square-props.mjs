// Hub track HB-10: Copperleaf's town square, shared by tools/patch-copperleaf-square.mjs, tools/build-copperleaf.mjs
// and the test: its shape (HB-10a) and what stands round its edge (HB-10b: Gehl, people stop at a square's edges and its
// middle fills last), laid by angle round the square's middle and an inset from its rim. Every edge prop carries
// `sq: 1`; laying again removes those first.
//
// The market faces you from the north rim (the walk camera looks north), between the lab and the library; planters
// flank the three streets where they come in (east, north-west, south-west); lamps round the rim; benches facing the
// fountain; a solar canopy on the south-east. Kept clear: the view toward the sky rail and the portal (VIEW), a walk
// round the fountain (nothing nearer its middle than WALK_R), the hub spot.

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

export const WALK_R = 4.6; /* nothing stands nearer the square's middle than this (m) */
export const VIEW = [15, 45]; /* degrees round the square kept low toward the portal */
/* [kind, degrees round the middle (0 east, 90 north), metres in from the rim, 'in' (its front to the fountain) or a
   rot] */
/** HB-10c: Copperleaf's folk (the map's `folk`): 10, the most drawn at once (the Engine's quality.townFolk) */
export const SQUARE_FOLK = 10;

export const SQUARE_EDGE = [
  /* the market on the north rim */
  ['market_cart', 58, 1.3, 'in'],
  ['stall', 80, 1.6, 'in'],
  ['crate_goods', 92, 0.9, 'in'],
  ['stall', 104, 1.6, 'in'],
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
];


/** the edge props for a map whose square's middle is the well plot: the map's props without the old ones, then the
 * new ones */
export function squareEdgeProps(M) {
  const well = M.plots.find(L => L.k === 'well'),
    out = [];
  for (const [k, deg, inset, face] of SQUARE_EDGE) {
    const a = (deg * Math.PI) / 180,
      r = squareRim(a) - inset,
      /* rot 0 faces south; facing the middle (degrees deg + 180) is rot deg + 270 (logic/prop-turn.js) */
      rot = face === 'in' ? ((((deg + 270) % 360) + 540) % 360) - 180 : face;
    out.push({ k, x: r2(well.x + Math.cos(a) * r), z: r2(well.z + Math.sin(a) * r), ...(rot ? { rot } : {}), sq: 1 });
  }
  return [...M.props.filter(p => !p.sq), ...out];
}
