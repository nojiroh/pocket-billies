// RL-5: the old world, for the tests that use its places as test data (the bowl's ground and landmarks, scripts that
// people say there): the game's places, roads, maps and trainers together with the ones parked in game/data/legacy
// (legacy/index.json, read as the game data is), each from whichever holds it. Parking moves a place from one to the
// other; a test reading it here sees the same place. Copperleaf, the hub, is the game's.
import { readGameData, readLegacyData } from '../data-files.mjs';

/** the game data with the old world's places, roads, maps and trainers; roads name places by their maps, so their
    numbers are this list's */
export function oldWorld() {
  const G = readGameData(),
    L = readLegacyData() || {},
    has = new Set(G.locations.map(l => l.id)),
    roads = new Set((G.roads || []).map(r => r.id));
  return {
    ...G,
    locations: [...G.locations, ...(L.locations || []).filter(l => !has.has(l.id))],
    roads: [...(G.roads || []), ...(L.roads || []).filter(r => !roads.has(r.id))],
    maps: { ...(L.maps || {}), ...G.maps },
    trainers: { ...(L.trainers || {}), ...G.trainers },
  };
}
