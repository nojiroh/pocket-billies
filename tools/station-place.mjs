// Cutscenes track A: the props that go with Skyline Station in Copperleaf, put down from the station as it stands (its
// base point the middle of its front, rot its turn) on its plot: the track out of its right-hand end (one piece per
// look of sky_rail, 12 m apart, SKY_RAIL; level with the station, a placement's y the plot's level) and the portal,
// floating on its own out in front (its placement's y lifts it: its middle SKY_RAIL.tear[2] m over the station's
// ground), turned to face the station. Shared by tools/build-copperleaf.mjs and tools/patch-station.mjs.
import { SKY_RAIL } from '../game/js/logic/island-gen.js';

const r2 = v => Math.round(v * 100) / 100;
/** the portal model's middle over its base point (tools/build-station-trains.py PORTAL_ZC) */
export const PORTAL_ZC = 6.5;

/** @param {{ x: number, z: number, rot?: number }} station @param {{ y: number }} L its plot
 * @param {Record<string, any>} C the catalogue's props @param {number} depth the station's box depth */
export function stationProps(station, L, C, depth) {
  const r = ((station.rot || 0) * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    /* u metres along its front toward its right-hand end, w metres back from its front */
    at = (k, u, w, extra) => {
      const q = { k, x: r2(station.x + u * c - w * s), z: r2(station.z + u * s + w * c), ...extra };
      return q;
    },
    track = depth / 2 + SKY_RAIL.from[1],
    out = [];
  SKY_RAIL.looks.forEach((look, i) => {
    const v = look ? (C.sky_rail.variants || []).findIndex(V => V.form === look) + 1 : 0;
    if (look && !v) throw new Error('sky_rail has no look ' + look);
    const q = at('sky_rail', SKY_RAIL.from[0] + SKY_RAIL.piece * (i + 0.5), track, v ? { v } : {});
    if (station.rot) q.rot = station.rot;
    q.y = L.y;
    out.push(q);
  });
  const P = at('sky_portal', SKY_RAIL.from[0] + SKY_RAIL.tear[0], track - SKY_RAIL.tear[1], {});
  /* it faces its -y: turned half round from the station, it faces back at it */
  P.rot = r2((((((station.rot || 0) + 180 + 180) % 360) + 360) % 360) - 180);
  P.y = r2(L.y + SKY_RAIL.tear[2] - PORTAL_ZC);
  out.push(P);
  return out;
}
