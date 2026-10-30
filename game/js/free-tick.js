'use strict';
/* ================= FREE TICKS =================
   Fluid track FL-4 (quality.freeTicks, off until the owner's phone run): the page's periodic jobs (the story checks,
   trainers in sight, the music's choice, the idle scan, Kappi's look and others) did their work wherever their timer
   fell, often just before a frame was due. With the switch on, each timer only asks for its work, which runs in the
   main thread's free time: an idle callback, or (where there is none, Safari) just after the next frame is drawn; at
   the latest one period later. A job never queues twice. The music's 25 ms clock and the footsteps keep their timers. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { engineSetting } from './hooks.js';
/* eslint-disable no-func-assign */
expose({
  everyFree: [() => everyFree, v => (everyFree = v)],
  freeTicks: [() => freeTicks],
  freeTicksOn: [() => freeTicksOn, v => (freeTicksOn = v)],
  freeTime: [() => freeTime, v => (freeTime = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* fn every ms milliseconds, in free time when the switch is on; returns the timer, for clearInterval */
export function everyFree(fn, ms) {
  let asked = false;
  const run = () => {
    asked = false;
    fn();
  };
  return setInterval(() => {
    if (!freeTicksOn()) return fn();
    if (asked) return;
    asked = true;
    freeTime(run, ms);
  }, ms);
}
function freeTicksOn() {
  try {
    return typeof engineSetting === 'function' && !!engineSetting('quality', 'freeTicks');
  } catch (e) {
    return false;
  }
}
/* run once in free time, within ms */
function freeTime(run, ms) {
  freeTicks.asked++;
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: ms });
    return;
  }
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    run();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(once, 0));
  setTimeout(once, ms);
}
/* how many runs were asked for (the checks) */
const freeTicks = { asked: 0 };
