'use strict';
/* ================= CUTSCENES: HAZEL'S STAGED FIGHT =================
   Phase 06-2b: before you have a Billie, Hazel fights Blake herself, staged to look like a battle (plates, a move
   line, the log). Project Story S6 makes it a real battle in the battle engine; this goes then. Split from cutscene.js. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { $ } from '../util.js';
import { RULES, SPECIES } from '../game-data.js';
import { formatNumber, maxHp } from '../logic/rules.js';
import { HAZEL, fillLine } from '../logic/hazel.js';
import { cutscenePoint } from '../logic/cutscene-set.js';
import { escapeHtml } from '../game-state.js';
import { buzz } from '../battle-stage.js';
import { standingHeightAt } from '../walk/heights.js';
import { soundEffect } from '../sound.js';
import { cutscene, cutsceneAct, cutsceneNow, cutsceneSparkle, cutsceneWait } from './director.js';
import { cutsceneLook } from './stage.js';
/* eslint-disable no-func-assign */
expose({
  blakeFirstBillie: [() => blakeFirstBillie, v => (blakeFirstBillie = v)],
  fightLog: [() => fightLog, v => (fightLog = v)],
  fightPlate: [() => fightPlate, v => (fightPlate = v)],
  hazelFight: [() => hazelFight, v => (hazelFight = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* Blake's first Billie: Gildlet (the slug line's first form) when the game has it, else any common first form */
function blakeFirstBillie() {
  if (SPECIES.trump0) return 'trump0';
  const starters = RULES.start.starters || [];
  return Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !starters.includes(SPECIES[k].line)) || null;
}
/* the fight's log line under the plates: waits for a tap (or goes at once when the opening is being skipped) */
function fightLog(text) {
  const box = $('#csFight'),
    t = box && box.querySelector('.csf-t');
  if (!t || cutscene.skip || !cutscene.on) return Promise.resolve();
  t.textContent = text;
  t.classList.remove('m-enter');
  void t.offsetWidth;
  t.classList.add('m-enter');
  const t0 = performance.now();
  return new Promise(res => {
    const done = () => {
      box.removeEventListener('click', onTap);
      clearInterval(poll);
      res();
    };
    const onTap = () => {
      /* a tap right away counts as skipping fast, like a line cut short */
      if (cutscene.skipWatch && !cutscene.quip) cutscene.quip = cutscene.skipWatch.record(performance.now() - t0);
      done();
    };
    box.addEventListener('click', onTap);
    /* the opening being skipped (the Skip button, the checks) or ended lets the fight go on */
    const poll = setInterval(() => {
      if (cutscene.skip || !cutscene.on) done();
    }, 150);
    if (cutscene.test) setTimeout(done, 300);
  });
}
function fightPlate(cls, name, lvl, hp, max) {
  return `<div class="csf-plate ${cls}"><div class="csf-top"><b>${escapeHtml(name)}</b><span class="tnum">${escapeHtml(lvl)}</span></div><span class="csf-hp"><i style="width:${max ? (hp / max) * 100 : 100}%"></i></span><small class="tnum">${formatNumber(hp)}/${formatNumber(max)}</small></div>`;
}
/* who: Blake's look (story.json speakers); his first Billie pops out on the middle starter's spot (star2) */
export async function hazelFight(who) {
  const id = blakeFirstBillie(),
    box = $('#csFight');
  if (!id || !box) return;
  const F = HAZEL.fight,
    name = SPECIES[id].name,
    vars = { foe: name };
  cutscene.foeName = name;
  let max = 19;
  try {
    max = maxHp({ sp: id, lvl: 4 }) || max;
  } catch (e) {}
  /* Blake throws a coin and his Billie pops out between them */
  const R = cutscene.actors[who],
    p = cutscenePoint(cutscene.set.spots.star2, cutscene.off),
    foe = { sp: id, x: p[0], z: p[1], pop: 0, a: 1, act: null, actT: 0, seed: 3.1, flip: -1, white: 0 };
  cutscene.foe = foe;
  if (R) cutsceneAct(who, 'throw', 900);
  if (typeof soundEffect === 'function') soundEffect('throw');
  cutscene.coins.push({
    a: [R.x - 0.2, standingHeightAt(R.x, R.z) + 1.35, R.z - 0.1],
    b: [p[0], standingHeightAt(p[0], p[1]) + 0.1, p[1]],
    t0: cutsceneNow(),
    dur: 650,
    onLand() {
      foe.popT = cutsceneNow();
      foe.act = 'enter';
      foe.actT = cutsceneNow();
      if (typeof soundEffect === 'function') soundEffect('pop');
      if (!cutscene.skip) cutsceneSparkle([p[0], standingHeightAt(p[0], p[1]) + 0.3, p[1]], 10);
    },
  });
  await cutsceneWait(900);
  cutscene.coins.forEach(c => {
    if (!c.landed) {
      c.landed = 1;
      c.onLand();
    }
  });
  cutscene.coins = [];
  if (!cutscene.on) return;
  /* the battle plates: Hazel (absurd) against Blake's Billie, a move line, the log */
  box.innerHTML = `<div class="csf-plates">${fightPlate('me', 'Prof. Hazel', 'Lv ???', 9999, 9999)}${fightPlate('foe', name, 'Lv 4', max, max)}</div><div class="csf-moves" hidden>${F.moves.map((m, i) => `<span class="${i === 0 ? 'on' : ''}">${escapeHtml(m)}</span>`).join('')}</div><button class="csf-log" type="button"><span class="csf-t"></span><small>Tap to go on</small></button>`;
  box.hidden = false;
  document.body.classList.add('cs-fighting');
  await fightLog(F.start);
  await fightLog(fillLine(F.blakeGo, vars));
  foe.act = 'attack';
  foe.actT = cutsceneNow();
  await fightLog(fillLine(F.tackle, vars));
  const mv = box.querySelector('.csf-moves');
  if (mv) mv.hidden = false;
  cutsceneAct(cutsceneLook('Chosen'), 'throw', 700);
  await fightLog(F.hit);
  if (mv) mv.hidden = true;
  /* one hit: the plate drains to zero, the Billie flashes white and goes */
  const fill = box.querySelector('.csf-plate.foe .csf-hp i'),
    num = box.querySelector('.csf-plate.foe small');
  if (fill) fill.style.width = '0%';
  if (num) num.textContent = `0/${formatNumber(max)}`;
  foe.white = 1;
  if (typeof soundEffect === 'function') soundEffect('hit');
  if (typeof buzz === 'function') buzz(20);
  await fightLog(F.effective);
  foe.leave = cutsceneNow();
  await fightLog(fillLine(F.faint, vars));
  box.hidden = true;
  box.innerHTML = '';
  document.body.classList.remove('cs-fighting');
  cutscene.foe = null;
}
