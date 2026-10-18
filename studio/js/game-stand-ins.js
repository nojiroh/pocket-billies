'use strict';
/* ================= POCKET BILLIES STUDIO · shims =================
   What the game's renderers read from the game (the save, the menus' state, the battle, reduced motion, esc and the
   data tables) when they run inside the Studio. Phase 04d: was an inline script in studio/index.html. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide, studioState } from '../../game/js/hooks.js';
expose({
  B: [() => B, v => ((B = v), provide({ B }))],
  BACKDROPS: [() => BACKDROPS],
  MOVES: [() => MOVES],
  PEOPLE: [() => PEOPLE],
  RM: [() => RM, v => ((RM = v), provide({ RM }))],
  TC: [() => TC],
  TYPEFX: [() => TYPEFX],
  esc: [() => esc],
  liveMap: [() => liveMap],
  saveData: [() => saveData, v => ((saveData = v), provide({ saveData }))],
  uiState: [() => uiState, v => ((uiState = v), provide({ uiState }))],
});
/* to-module: end */
var saveData = { preferences: {}, gender: 'boy', avatar: null },
  uiState = {},
  B = null,
  RM = false;
provide({ B, RM, saveData, uiState }); /* to-module */
export const esc = s =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
/* the game's tables, read live from the Studio's unsaved data (studioState is declared in js/studio-app.js) */
const liveMap = f =>
  new Proxy(
    {},
    {
      get: (t, k) => {
        const o = typeof studioState !== 'undefined' && studioState.D ? f(studioState.D) : null;
        return o ? o[k] : undefined;
      },
      has: (t, k) => {
        const o = typeof studioState !== 'undefined' && studioState.D ? f(studioState.D) : null;
        return !!o && k in o;
      },
      ownKeys: () => {
        const o = typeof studioState !== 'undefined' && studioState.D ? f(studioState.D) : null;
        return o ? Reflect.ownKeys(o) : [];
      },
      getOwnPropertyDescriptor: (t, k) => {
        const o = typeof studioState !== 'undefined' && studioState.D ? f(studioState.D) : null;
        if (o && k in o) return { value: o[k], enumerable: true, configurable: true, writable: true };
      },
    }
  );
const BACKDROPS = liveMap(D => D.backdrops),
  MOVES = liveMap(D => D.moves),
  PEOPLE = liveMap(D => D.people);
provide({ BACKDROPS, MOVES, PEOPLE }); /* to-module */
const TC = liveMap(D => {
  const o = Object.fromEntries(D.types.map(t => [t.id, [t.color, t.text || '#fff']]));
  o.None = [(D.untyped || {}).color || '#9a9a9a', (D.untyped || {}).text || '#fff'];
  return o;
});
provide({ TC }); /* to-module */
const TYPEFX = liveMap(D => {
  const o = Object.fromEntries(D.types.map(t => [t.id, t.fx && t.fx.length ? t.fx : ['pow', 'star']]));
  o.None = (D.untyped || {}).fx || ['pow', 'star'];
  return o;
});
provide({ TYPEFX }); /* to-module */
