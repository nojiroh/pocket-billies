'use strict';
/* Phase 04c: small helpers the game and the Studio both use, in one module both pages load first, so every module
   imports them (a direct call the engine can inline) instead of reaching a global through the window bridge (clamp in
   the ground height code was the hot one). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
expose({ $: [() => $], $$: [() => $$], clamp: [() => clamp], random: [() => random] });
/* to-module: end */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const random = Math.random;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
