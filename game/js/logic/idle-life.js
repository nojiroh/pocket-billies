// @ts-check
'use strict';
/* ================= IDLE LIFE (UI track, UI-17) =================
   The loops that run with no cause (docs/phases/ui-track.md Part 2, rule 5 and "Alive, without clutter": idle loops
   are slow, small and at most two on screen). Each kind of idle loop is listed here with the page elements that show
   it; the page (ui-idle.js) looks at what is on screen, keeps the first two kinds in IDLE_KINDS' order and writes them
   on <html data-idle>. Calm (UI-16a) and Reduced keep none. The glint and the foil are as bright as SY-1's rule lets a
   white flash be (logic/smear.js flashFor): softer with Flashes off, none under Reduced.
   IDLE_LOOPS and SIGNAL_LOOPS name every endless CSS loop in the game, so tools/test/idle-life.test.mjs can count
   them: a new `infinite` animation fails the test until it is listed as idle (and so budgeted) or as a signal (a
   loop that says something: low HP, aim, news, loading). Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { flashFor } from './smear.js';
/* eslint-disable no-func-assign */
expose({
  IDLE_KINDS: [() => IDLE_KINDS],
  IDLE_LOOPS: [() => IDLE_LOOPS],
  IDLE_MAX: [() => IDLE_MAX],
  SIGNAL_LOOPS: [() => SIGNAL_LOOPS],
  STILL_LEVELS: [() => STILL_LEVELS],
  // @ts-expect-error -- replaced on purpose
  idlePick: [() => idlePick, v => (idlePick = v)],
  // @ts-expect-error -- replaced on purpose
  sheenAlpha: [() => sheenAlpha, v => (sheenAlpha = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** at most this many kinds of idle loop on screen at once (rule 5) */
export const IDLE_MAX = 2;

/** the kinds of idle loop, most wanted first (loops that carry meaning before decoration): the map's life (the places
 * you can reach breathe, your pin bobs), foil (a Coat, a rare or mythical frame), today's forecast, the main action's
 * glint, the dialogue bubble's drift, the battle camera's sway, the lead Billie's breathing, the coins (the top bar's
 * Moneys coin, the title's coin), the title's logo and the battle's bloom. `sel` finds one on the page (light DOM:
 * a kit part counts by its host). */
export const IDLE_KINDS = [
  { k: 'map', sel: '#mapcv', what: 'the map: reachable places breathe, your pin bobs' },
  {
    k: 'foil',
    sel: 'pb-foil, pb-pick-card:is([rarity="rare"], [rarity="mythical"])',
    what: 'the foil on Coats and rare frames',
  },
  { k: 'forecast', sel: '.wx-now, pb-forecast', what: 'today’s forecast icon' },
  {
    k: 'glint',
    sel: '.pb.gold:not(:disabled), pb-button[kind="gold"]:not([disabled]), .bt.fight, .bdg.got',
    what: 'a glint across the main action',
  },
  { k: 'bubble', sel: '.talk-box', what: 'the dialogue bubble’s drift' },
  { k: 'stage', sel: '.fgcam canvas', what: 'the battle camera’s sway' },
  { k: 'breathe', sel: '.m-idle', what: 'the lead Billie breathing' },
  { k: 'coin', sel: '.title-coin, .tb-chip[title="Money"] .pxi', what: 'the coins turning' },
  { k: 'logo', sel: '.ttl-logo', what: 'the title’s words bobbing' },
  { k: 'bloom', sel: '.bloom', what: 'the battle’s light pulsing' },
];

/** the levels with no idle loops (UI-16a's Animation setting: Calm is Full without them, Reduced keeps fades only) */
export const STILL_LEVELS = ['calm', 'reduced'];

/** the idle kinds that play: the first IDLE_MAX of those present, in IDLE_KINDS' order; none under Calm or Reduced
 * @param {Iterable<string>} present the kinds on screen @param {string} level full, calm or reduced
 * @returns {string[]} */
export function idlePick(present, level) {
  if (STILL_LEVELS.includes(level)) return [];
  const on = new Set(present);
  return IDLE_KINDS.map(K => K.k)
    .filter(k => on.has(k))
    .slice(0, IDLE_MAX);
}

/** the glint's and the foil's strength, 0..1 (multiplies the sheen's own opacity): SY-1's rule for a white flash, so
 * Flashes off softens them to its cap and Reduced has none; 0 under Calm too (they are idle loops)
 * @param {string} level @param {boolean} flashesOff */
export function sheenAlpha(level, flashesOff) {
  if (STILL_LEVELS.includes(level)) return 0;
  const F = flashFor('white', 1, level === 'reduced', flashesOff);
  return F ? F.a : 0;
}

/** every endless idle loop in the game's CSS: its file, its rule's selector as written there, and its kind. motion.css
 * stops each when its kind is not in <html data-idle>; a kit part's loop (in a shadow root) takes its keyframes'
 * name from --idle-<kind>, which motion.css sets only while the kind plays */
export const IDLE_LOOPS = [
  { file: 'game/css/base.css', sel: '.pb.gold::after', kind: 'glint' },
  { file: 'game/css/base.css', sel: '.bloom', kind: 'bloom' },
  { file: 'game/css/battle-screen.css', sel: '.fgcam canvas', kind: 'stage' },
  { file: 'game/css/battle-screen.css', sel: '.bt.fight::before', kind: 'glint' },
  { file: 'game/css/dialogue.css', sel: '.talk-box::before,', kind: 'bubble' },
  { file: 'game/css/motion.css', sel: '.m-idle', kind: 'breathe' },
  { file: 'game/css/motion.css', sel: '.wx-now', kind: 'forecast' },
  { file: 'game/css/profile.css', sel: '.bdg.got .bdg-m::after', kind: 'glint' },
  { file: 'game/css/shell.css', sel: ".tb-chip[title='Money'] .pxi", kind: 'coin' },
  { file: 'game/css/title.css', sel: '.title-coin', kind: 'coin' },
  { file: 'game/css/title.css', sel: '.ttl-logo span', kind: 'logo' },
  { file: 'game/js/ui-kit.js', sel: '.band', kind: 'foil' },
  { file: 'game/js/ui-run-kit.js', sel: "li[aria-current='date'] .ic", kind: 'forecast' },
  { file: 'game/js/ui-kit.js', sel: ":host([kind='gold']) .face::after", kind: 'glint' },
];

/** the endless loops that say something, outside the budget (they stop when what they say stops) */
export const SIGNAL_LOOPS = [
  { file: 'game/css/base.css', sel: '.pb.red.pulse::after', why: 'a red call to act now' },
  { file: 'game/css/base.css', sel: '.spr img', why: 'a Billie’s own two-frame art' },
  { file: 'game/css/base.css', sel: '.pbar.live i', why: 'progress running' },
  { file: 'game/css/base.css', sel: '.boot', why: 'loading' },
  { file: 'game/css/battle-screen.css', sel: '.lowhp.on', why: 'low HP' },
  { file: 'game/css/battle-screen.css', sel: '.bmsg.ready .more', why: 'tap for more' },
  { file: 'game/css/battle-screen.css', sel: '.aimcoin', why: 'aim the throw' },
  { file: 'game/css/battle-screen.css', sel: '.aim-hint', why: 'aim the throw' },
  { file: 'game/css/battle-screen.css', sel: '.bplate .pl-hp .fill.low', why: 'low HP' },
  { file: 'game/css/battle-screen.css', sel: '.bplate.aim', why: 'pick a target' },
  { file: 'game/css/battle-screen.css', sel: "#camWorld[data-wx='rain']::after,", why: 'the weather' },
  { file: 'game/css/battle-screen.css', sel: "#camWorld[data-wx='snow']::after", why: 'the weather' },
  { file: 'game/css/battle-screen.css', sel: "#camWorld[data-wx='ash']::after", why: 'the weather' },
  { file: 'game/css/loader.css', sel: '#loader .ld-sun', why: 'loading' },
  { file: 'game/css/loader.css', sel: '#loader .ld-stars', why: 'loading' },
  { file: 'game/css/loader.css', sel: '#loader .ld-logo span', why: 'loading' },
  { file: 'game/css/loader.css', sel: '#loader .ld-phase::after', why: 'loading' },
  { file: 'game/css/opening.css', sel: '.btip-hot', why: 'the tutorial’s hint' },
  { file: 'game/css/talk.css', sel: '.talk .dlg .pb::before', why: 'tap for more' },
  { file: 'game/css/talk.css', sel: '.talk-box.done .talk-more', why: 'tap for more' },
  { file: 'game/css/title.css', sel: '.ttl-hint', why: 'tap to start' },
  { file: 'game/css/walk-tab.css', sel: '.wob', why: 'an egg ready to hatch' },
  { file: 'game/css/walk-tab.css', sel: '.wh-down.new', why: 'news in Actions' },
  { file: 'game/js/ui-run-kit.js', sel: "li[data-s='working']::before", why: 'loading' },
];
