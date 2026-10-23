'use strict';
/* ================= BATTLE WEATHER =================
   Battles feel the weather where you stand (or a run node's forecast, set on activeBattle.wx): a line when a battle
   opens, a type's multiplier for the battle engine, and the painted stage's rain, snow, ash or night. TC-1: moved
   out of things-to-do.js (v28) when that system went. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { RULES } from './game-data.js';
import { battleWeatherOf } from './logic/weather.js';
import { battleSay } from './logic/battle-engine.js';
import { activeBattle } from './game-state.js';
import { walkView } from './walk-view.js';
import { currentLocationMap, environment, environmentState } from './environment.js';
import { openBattle, setOpenBattle } from './battle.js';
/* eslint-disable no-func-assign */
expose({
  WEATHER_BATTLE_NOTES: [() => WEATHER_BATTLE_NOTES],
  battleWeather: [() => battleWeather, v => (battleWeather = v)],
  battleWeatherMultiplier: [
    () => battleWeatherMultiplier,
    v => ((battleWeatherMultiplier = v), provide({ battleWeatherMultiplier })),
  ],
});
/* eslint-enable no-func-assign */
provide({ battleWeatherMultiplier });
/* to-module: end */
/* ---------- battles feel the weather ---------- */
const WEATHER_BATTLE_NOTES = {
  rain: 'It’s raining: Water moves hit harder and Fire moves fizzle.',
  storm: 'A storm is raging: Electric and Water moves are stronger, Fire weaker.',
  snow: 'Snow is falling: Steel moves are a little stronger, Grass a little weaker.',
  fog: 'In the fog, Psychic moves are a little stronger.',
  ash: 'Ash is falling: Fire and Ground moves hit harder, Water a little weaker.',
  sunny: 'The sun is out: Fire and Grass moves are a little stronger.',
  night: 'It’s night: Psychic and Dragon moves are a little stronger.',
};
function battleWeather() {
  if (typeof activeBattle === 'undefined' || !activeBattle) return null;
  if (activeBattle.wx !== undefined) return activeBattle.wx;
  if (typeof environmentState !== 'function' || !environment.on || (RULES.env && RULES.env.battleOff))
    return (activeBattle.wx = null);
  const sc = currentLocationMap();
  if (!sc || sc.indoor) return (activeBattle.wx = null);
  const st = environmentState(sc),
    k = st.night > 0.5 ? (st.wx === 'clear' ? 'night' : st.wx) : st.wx === 'clear' ? 'sunny' : st.wx;
  return (activeBattle.wx = battleWeatherOf(k, RULES.env));
}
function battleWeatherMultiplier(t) {
  const w = battleWeather();
  return (w && w.m[t]) || 1;
}
/* a weather line when a battle opens */
(function () {
  if (typeof openBattle === 'function') {
    const ob = openBattle;
    setOpenBattle(function () {
      try {
        const w = battleWeather();
        if (w && WEATHER_BATTLE_NOTES[w.k]) battleSay(WEATHER_BATTLE_NOTES[w.k]);
      } catch (e) {}
      return ob.apply(this, arguments);
    });
  }
})();
/* the painted battle stage gets rain, snow, ash or the night drawn over it (the 3D stage has the real thing) */
setInterval(() => {
  const el = document.getElementById('camWorld');
  if (!el) return;
  const w =
      typeof activeBattle !== 'undefined' && activeBattle && !(typeof walkView !== 'undefined' && walkView.battle)
        ? battleWeather()
        : null,
    k = w ? w.k : '';
  if (el.dataset.wx !== k) el.dataset.wx = k;
}, 500);
