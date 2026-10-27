'use strict';
/* ================= POCKET BILLIES STUDIO · shims =================
   What the game's renderers read from the game (the save, the menus' state, the battle, reduced motion, esc and the
   data tables) when they run inside the Studio. Phase 04d: was an inline script in studio/index.html. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide, studioState } from '../../game/js/hooks.js';
expose({
  BATTLE_STAGES: [() => BATTLE_STAGES],
  HIT_EFFECTS_BY_TYPE: [() => HIT_EFFECTS_BY_TYPE],
  MOVES: [() => MOVES],
  PEOPLE: [() => PEOPLE],
  RULES: [() => RULES],
  TYPE_COLORS: [() => TYPE_COLORS],
  TYPE_GLOW: [() => TYPE_GLOW],
  activeBattle: [() => activeBattle, v => ((activeBattle = v), provide({ activeBattle }))],
  escapeHtml: [() => escapeHtml],
  liveMap: [() => liveMap],
  reducedMotion: [() => reducedMotion, v => ((reducedMotion = v), provide({ reducedMotion }))],
  saveData: [() => saveData, v => ((saveData = v), provide({ saveData }))],
  uiState: [() => uiState, v => ((uiState = v), provide({ uiState }))],
});
/* to-module: end */
export var saveData = { preferences: {}, gender: 'boy', avatar: null },
  uiState = {},
  activeBattle = null,
  reducedMotion = false;
provide({ activeBattle, reducedMotion, saveData, uiState }); /* to-module */
export const escapeHtml = s =>
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
export const BATTLE_STAGES = liveMap(D => D.battleStages),
  MOVES = liveMap(D => D.moves),
  PEOPLE = liveMap(D => D.people),
  /* phase 16: the rig drawing reads RULES.parts (part sizes) */
  RULES = liveMap(D => D.rules);
provide({ BATTLE_STAGES, MOVES, PEOPLE, RULES }); /* to-module */
const TYPE_COLORS = liveMap(D => {
  const o = Object.fromEntries(D.types.map(t => [t.id, [t.color, t.text || '#fff']]));
  o.None = [(D.untyped || {}).color || '#9a9a9a', (D.untyped || {}).text || '#fff'];
  return o;
});
/* UI-13: battle's 3D effects take a type's `glow` (game-data.js TYPE_GLOW) */
const TYPE_GLOW = liveMap(D => {
  const o = Object.fromEntries(D.types.map(t => [t.id, t.glow || t.color]));
  o.None = (D.untyped || {}).glow || (D.untyped || {}).color || '#9a9a9a';
  return o;
});
provide({ TYPE_GLOW }); /* to-module */
const HIT_EFFECTS_BY_TYPE = liveMap(D => {
  const o = Object.fromEntries(D.types.map(t => [t.id, t.fx && t.fx.length ? t.fx : ['pow', 'star']]));
  o.None = (D.untyped || {}).fx || ['pow', 'star'];
  return o;
});
provide({ HIT_EFFECTS_BY_TYPE }); /* to-module */
