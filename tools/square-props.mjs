// Hub track HB-10: the shape of Copperleaf's town square, shared by tools/patch-copperleaf-square.mjs and its test.

export const SQUARE_R = 10; /* the square's mean radius (m) */

/** the square's rim, metres from its middle at angle a (radians, 0 east, 90 degrees north): a bulge toward the
 * north-east (the sky rail and the portal), three soft lobes and a little wobble, kept between 8.2 and 11.8 m */
export const squareRim = a =>
  Math.max(
    8.2,
    Math.min(11.8, SQUARE_R + 1.2 * Math.cos(a - 0.6) + 0.6 * Math.sin(3 * a + 0.9) + 0.3 * Math.sin(7 * a + 2.3))
  );
