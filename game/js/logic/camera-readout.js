// @ts-check
'use strict';
/* ================= CAMERA READOUT (camera track CAM-4a) =================
   The real numbers behind the walking camera, for the Studio's Camera section: its tilt, height and distance, the
   field of view, how many metres it shows across at the aim, and how big an art pixel (the art is 32 px a metre)
   comes out in the game's own drawing pixels, here and on a reference screen. Plain numbers
   (tools/test/camera-readout.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  ART_PX_PER_M: [() => ART_PX_PER_M],
  // @ts-expect-error -- replaced on purpose
  cameraReadout: [() => cameraReadout, v => (cameraReadout = v)],
  // @ts-expect-error -- replaced on purpose
  crispScale: [() => crispScale, v => (crispScale = v)],
  // @ts-expect-error -- replaced on purpose
  gameRenderWidth: [() => gameRenderWidth, v => (gameRenderWidth = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the art's pixels a metre (CLAUDE.md: models textured at 32 px/m) */
export const ART_PX_PER_M = 32;
/**
 * What the walking camera shows (walk/camera.js walkCamera's result: its drawing size, F, distance and tilt).
 * @param {{rw: number, rh: number, F: number, df: number, sp: number}} C
 * @returns {{tilt: number, height: number, dist: number, vfov: number, hfov: number, across: number, artPx: number}}
 *   tilt and the fields of view in degrees; height (above the aim), distance and metres across at the aim in m;
 *   artPx: drawing pixels an art pixel covers at the aim
 */
export function cameraReadout(C) {
  const deg = 180 / Math.PI,
    across = (C.df * C.rw) / C.F;
  return {
    tilt: Math.asin(Math.max(-1, Math.min(1, C.sp))) * deg,
    height: C.df * C.sp,
    dist: C.df,
    vfov: 2 * Math.atan(C.rh / 2 / C.F) * deg,
    hfov: 2 * Math.atan(C.rw / 2 / C.F) * deg,
    across,
    artPx: C.rw / across / ART_PX_PER_M,
  };
}
/**
 * The game's drawing width for a screen, as walk-view-gl.js works it out (the device's pixel ratio up to 1.75, times
 * the resolution dial, within a budget of 1.6 million pixels, at most 2400 wide; the automatic quality left alone).
 * @param {number} cssW the screen's width in CSS pixels
 * @param {number} cssH its height
 * @param {number} dpr its device pixel ratio
 * @param {number} resolution Engine > Quality > Resolution
 */
export function gameRenderWidth(cssW, cssH, dpr, resolution) {
  const R0 = Math.min(dpr || 1, 1.75) * resolution,
    R = R0 * Math.min(1, Math.sqrt(1.6e6 / (cssW * cssH * R0 * R0)));
  return Math.max(64, Math.min(2400, Math.round(cssW * R)));
}
/**
 * How near a scale is to whole drawing pixels an art pixel: the whole number and whether it is within `tol` of it.
 * @param {number} artPx drawing pixels an art pixel covers
 * @param {number} [tol]
 */
export function crispScale(artPx, tol = 0.06) {
  const n = Math.max(1, Math.round(artPx));
  return { n, crisp: Math.abs(artPx - n) <= tol * n };
}
