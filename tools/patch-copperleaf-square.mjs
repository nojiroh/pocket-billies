// Hub track HB-10a: Copperleaf's town square, by hand patches inside its locked town zone (an unlocked rebuild makes
// the town again differently: hub-track.md HB-10f). The ground stays locked; only what is named below changes.
// Rerunnable: a second run changes nothing.
//
//   node tools/patch-copperleaf-square.mjs --outline   # the square paved to a lobed rim about SQUARE_R metres out
//   node tools/patch-copperleaf-square.mjs --fountain  # the fountain in the middle in place of the well
//   node tools/patch-copperleaf-square.mjs --edges     # HB-10b: the market, lamps, planters and benches round its rim
//   node tools/patch-copperleaf-square.mjs --hub       # HB-10b: the hub's spot clear of the fountain (squareHubSpot)
//   node tools/patch-copperleaf-square.mjs --folk      # HB-10c: the town's folk, SQUARE_FOLK of them
//
// --outline: the paved square (ground letter c) reaches squareRim(a) metres from its middle (the well plot): about
// 10 m on average (the owner: between WA-10's 8 m and the generator's 12 m), bulging toward the sky rail and the portal
// (north-east) and drawn in on the west, where a cottage stands close. Inside the rim every ground tile of the old 12 m
// square (c, G or p) is paved; outside it the old square is grass (G), except where a street met the old rim: the street
// carries on to the new one. The generator's square was level out to 12 m, so heights are untouched; plots, buildings
// and props too. Replaces WA-10's `patch-copperleaf-water.mjs --square` (8 m).
// --fountain: the fountain (a low-poly model, 1.75 m round) stands where the well stood; the signpost goes 4.5 m from
// the middle on the side away from the lab, clear of the basin (build-copperleaf.mjs puts it there too). HB-10d: with
// its looks per chapter on the same spot (FOUNTAIN_LOOKS).
// --edges: what stands round the rim (tools/square-props.mjs, which build-copperleaf.mjs uses too), laid again.
// --hub: the hub's spot to squareHubSpot (a push up from it runs past the fountain), the walking checks' starts with it.
// --folk: the town's folk (`folk`, kept by build-copperleaf.mjs on a rebuild): SQUARE_FOLK, the most the Engine's
// quality.townFolk draws at once, so the square's busy midday can reach it.
// Written through tools/write-data.mjs, as every build tool writes the data.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { readGameData, ROOT } from './data-files.mjs';
import { islandDress } from './island-dress.mjs';
import {
  FOUNTAIN_LOOKS,
  SQUARE_FOLK,
  SQUARE_R,
  fountainLooks,
  moveHub,
  squareEdgeProps,
  squareHubSpot,
  squareRim,
} from './square-props.mjs';

const OLD_R = 12; /* the generator's square (paved and level out to here) */
const STREET_HALF = 1.1; /* half a street's width (the island's paths are 2.2 m) */
const SIGN_OUT = 4.5; /* the signpost's distance from the middle (m) */

const main = () => {
  const D = readGameData(),
    M = D.maps.copperleaf,
    { w, h } = M,
    args = process.argv.slice(2);
  if (!['--outline', '--fountain', '--edges', '--hub', '--folk'].some(a => args.includes(a))) {
    console.error('usage: node tools/patch-copperleaf-square.mjs --outline | --fountain | --edges | --hub | --folk');
    process.exit(1);
  }
  const tile = (i, j) => (M.tiles[h - 1 - j] || '')[i],
    setTile = (i, j, c) => {
      const r = M.tiles[h - 1 - j];
      M.tiles[h - 1 - j] = r.slice(0, i) + c + r.slice(i + 1);
    },
    well = M.plots.find(L => L.k === 'well'),
    [sx, sz] = [well.x, well.z];
  const notes = [];

  if (args.includes('--outline')) {
    /* where the streets meet the old rim: street tiles just outside it, by their angle round the square */
    const ends = [];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const r = Math.hypot(i + 0.5 - sx, j + 0.5 - sz);
        if (r > OLD_R && r <= OLD_R + 1.6 && tile(i, j) === 'p') ends.push(Math.atan2(j + 0.5 - sz, i + 0.5 - sx));
      }
    const onStreet = (x, z) =>
      ends.some(a => {
        const ux = Math.cos(a),
          uz = Math.sin(a),
          al = (x - sx) * ux + (z - sz) * uz;
        return al > 0 && Math.abs((x - sx) * uz - (z - sz) * ux) <= STREET_HALF;
      });
    const n = { paved: 0, grass: 0, street: 0 };
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const t = tile(i, j),
          x = i + 0.5,
          z = j + 0.5,
          r = Math.hypot(x - sx, z - sz);
        if (r > OLD_R || !'cGp'.includes(t)) continue;
        const want = r <= squareRim(Math.atan2(z - sz, x - sx)) ? 'c' : t !== 'c' ? t : onStreet(x, z) ? 'p' : 'G';
        if (want === t) continue;
        setTile(i, j, want);
        n[want === 'c' ? 'paved' : want === 'p' ? 'street' : 'grass']++;
      }
    M.islandGen.dials.town.square = { ...M.islandGen.dials.town.square, r: SQUARE_R };
    notes.push(`the square: ${n.paved} tiles paved, ${n.grass} to grass, ${n.street} to street`);
  }

  if (args.includes('--fountain')) {
    const P = M.props.find(
      p => !p.dress && (p.k === 'well' || p.k === 'fountain') && Math.hypot(p.x - sx, p.z - sz) < 1
    );
    if (!P) throw new Error('nothing stands in the middle of the square');
    P.k = 'fountain';
    delete P.rot;
    const S = M.props.find(p => p.k === 'signpost'),
      lab = M.plots.find(L => L.k === 'lab'),
      dx = sx - lab.x,
      dz = sz - lab.z,
      l = Math.hypot(dx, dz) || 1;
    S.x = Math.round((sx + (dx / l) * SIGN_OUT) * 100) / 100;
    S.z = Math.round((sz + (dz / l) * SIGN_OUT) * 100) / 100;
    M.props = fountainLooks(M);
    notes.push(`the fountain at ${P.x}, ${P.z} (looks: ${FOUNTAIN_LOOKS.map(f => f[0]).join(', ')}); the signpost at ${S.x}, ${S.z}`);
  }

  if (args.includes('--edges')) {
    const before = M.props.filter(p => p.sq).length;
    M.props = squareEdgeProps(M);
    notes.push(`round the square: ${M.props.filter(p => p.sq).length} props (${before} before)`);
  }

  if (args.includes('--hub')) {
    const was = M.hub;
    moveHub(M, squareHubSpot(M));
    notes.push(`the hub's spot ${was} -> ${M.hub}`);
  }

  if (args.includes('--folk')) {
    notes.push(`the town's folk: ${SQUARE_FOLK} (${M.folk} before)`);
    M.folk = SQUARE_FOLK;
  }

  /* the dressing reads the ground (a street, the square), so it is laid again as build-copperleaf.mjs lays it, last */
  {
    const town = M.props.filter(p => !p.dress),
      O = JSON.parse(readFileSync(join(ROOT, 'tools/data/copperleaf-town.json'), 'utf8')).dress || {},
      before = M.props.length - town.length,
      dressed = islandDress({ ...M, props: town }, D.scenery, O);
    M.props = [...town, ...dressed.props];
    notes.push(`the dressing laid again: ${dressed.props.length} props (${before} before)`);
  }
  execFileSync('node', [join(ROOT, 'tools/write-data.mjs')], {
    input: JSON.stringify(D),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  for (const n of notes) console.log(n);
};

if (import.meta.url === `file://${process.argv[1]}`) main();
