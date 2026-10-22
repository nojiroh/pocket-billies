'use strict';
/* ================= POCKET BILLIES STUDIO · Music & sound (sound track SND-3) =================
   game/data/music.json: the songs (a recipe each, composed by the game's own tracker), the where table that picks
   one for where you are, and the jingles. Play and loop any song through the game's tracker (game/js/audio/tracker.js)
   on the Studio's own AudioContext, made on the first press of a play button (a browser starts sound only after one).
   Every edit is heard at once: the tracker composes the song again and keeps its place. Playing stops by itself when
   the section is off screen. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { trackerCreate } from '../../game/js/audio/tracker.js';
import { escapeHtml } from './game-stand-ins.js';
import { musicNoteName, musicSongUses } from '../../game/js/logic/music-studio.js';
import { ACTIONS, SECTIONS, afterRender, card, render, sectionShown, studioState } from './studio-app.js';
import { legacyLoad, legacyView } from './legacy-view.js';
/* eslint-disable no-func-assign */
expose({
  musicData: [() => musicData],
  musicLoopHTML: [() => musicLoopHTML],
  musicNowShow: [() => musicNowShow, v => (musicNowShow = v)],
  musicPlay: [() => musicPlay, v => (musicPlay = v)],
  musicPlaying: [() => musicPlaying],
  musicSelected: [() => musicSelected],
  musicSongIds: [() => musicSongIds],
  musicSongListHTML: [() => musicSongListHTML, v => (musicSongListHTML = v)],
  musicStop: [() => musicStop, v => (musicStop = v)],
  musicStudio: [() => musicStudio],
  musicSummary: [() => musicSummary],
  musicTracker: [() => musicTracker, v => (musicTracker = v)],
  musicUses: [() => musicUses, v => (musicUses = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const musicStudio = {
  /** @type {AudioContext | null} */ ctx: null,
  /** @type {any} */ tracker: null,
  loop: true,
  shown: '',
};
const musicData = () => studioState.D.music;
const musicSongIds = () => Object.keys(musicData().songs);
const musicSelected = () => {
  const ids = musicSongIds();
  if (!ids.includes(studioState.sel.musicSong)) studioState.sel.musicSong = ids[0];
  return studioState.sel.musicSong;
};
/* where each song plays: the where table, the places (the parked ones too, once read), the scripts and the code */
function musicUses() {
  const D = studioState.D,
    parked = legacyView.data ? legacyView.data.locations || [] : [],
    scripts = JSON.stringify([D.story, D.trainers, D.cutscenes, legacyView.data ? legacyView.data.trainers : null]);
  return musicSongUses(musicData(), {
    locations: [...(D.locations || []), ...parked.map(L => ({ ...L, id: L.id + ' (parked)' }))],
    scriptText: scripts,
  });
}

/* ---------- the player ---------- */
function musicTracker() {
  if (musicStudio.tracker) return musicStudio.tracker;
  const AC = window.AudioContext || window.webkitAudioContext,
    ctx = new AC(),
    out = ctx.createGain(),
    squash = ctx.createDynamicsCompressor();
  out.gain.value = 0.8;
  out.connect(squash);
  squash.connect(ctx.destination);
  const T = trackerCreate(ctx, out, { songs: musicData().songs });
  /* the tracker's scheduler also keeps the section honest: off screen it stops; with Loop off a song stops after its
     last bar; the bar playing shows beside the song */
  const tick = T.tick;
  T.tick = () => {
    if (!sectionShown('music')) return musicStop();
    tick();
    const sg = T.song;
    if (sg && !musicStudio.loop && sg.step >= sg.D.steps) return musicStop();
    musicNowShow();
  };
  musicStudio.ctx = ctx;
  musicStudio.tracker = T;
  return T;
}
/** play a song from its start (pressed again, it starts over) */
function musicPlay(name) {
  const T = musicTracker();
  if (musicStudio.ctx.state !== 'running') musicStudio.ctx.resume().catch(() => {});
  T.refresh(musicData().songs);
  if (T.song) T.stop();
  T.play(name);
  musicNowShow();
}
function musicStop() {
  if (musicStudio.tracker && musicStudio.tracker.song) musicStudio.tracker.stop();
  musicNowShow();
}
/* the line under the list: what plays, and its bar; drawn without a re-render (25 ms ticks) */
function musicNowShow() {
  const T = musicStudio.tracker,
    sg = T && T.song,
    text = sg
      ? `▶ ${sg.name} · bar ${Math.floor((sg.step % sg.D.steps) / 16) + 1} of ${sg.D.steps / 16}`
      : 'Nothing playing';
  if (text === musicStudio.shown) return;
  musicStudio.shown = text;
  const el = document.getElementById('musNow');
  if (el) el.textContent = text;
  for (const b of document.querySelectorAll('[data-act="musPlay"]'))
    b.classList.toggle('on', !!sg && /** @type {HTMLElement} */ (b).dataset.song === sg.name);
}
/** the song playing, or '' (for the self-test and the Studio check) */
const musicPlaying = () => (musicStudio.tracker && musicStudio.tracker.song ? musicStudio.tracker.song.name : '');

/* ---------- the section ---------- */
const musicSummary = S =>
  `${S.bpm} bpm · ${musicNoteName(S.key).replace(/\d+$/, '')} ${S.scale} · ${S.drums === 'none' ? 'no' : S.drums} drums`;
function musicSongListHTML(uses) {
  const cur = musicSelected();
  return musicSongIds()
    .map(id => {
      const S = musicData().songs[id],
        u = uses[id] || [];
      return `<div class="mus-row ${id === cur ? 'on' : ''}"><button class="btn subtle mus-play" data-act="musPlay" data-song="${escapeHtml(id)}" title="Play ${escapeHtml(id)}" aria-label="Play ${escapeHtml(id)}">▶</button><button class="lcard slim" data-act="musPick" data-song="${escapeHtml(id)}"><span class="lt"><b>${escapeHtml(id)}</b><small>${escapeHtml(musicSummary(S))}</small></span>${u.length ? '' : '<span class="warn" title="No where-rule, place, script or code plays it">unused</span>'}</button></div>`;
    })
    .join('');
}
SECTIONS.music = () => {
  if (!studioState.D.music) return card('Music', '<p class="help">This game data has no music.json.</p>');
  if (!legacyView.data && !legacyView.loading && !legacyView.error)
    legacyLoad().then(() => {
      if (sectionShown('music')) render();
    });
  if (musicStudio.tracker) musicStudio.tracker.refresh(musicData().songs);
  const id = musicSelected(),
    uses = musicUses(),
    u = uses[id] || [];
  const plays = u.length
    ? `<ul class="mus-uses">${u.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`
    : '<p class="warn">Nothing plays this song: no where-rule, place, story script or code names it.</p>';
  musicStudio.shown = '';
  afterRender(musicNowShow);
  return `<div class="split"><aside class="list-col"><div class="list-head"><div class="seg-row"><button class="btn primary" data-act="musStop">■ Stop</button>${musicLoopHTML()}</div><small id="musNow" class="mono" aria-live="polite">Nothing playing</small></div><div class="llist" id="musList">${musicSongListHTML(uses)}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><small class="mono">music.json · songs.${escapeHtml(id)}</small><h2>${escapeHtml(id)}</h2></div><div class="seg-row"><button class="btn primary" data-act="musPlay" data-song="${escapeHtml(id)}">▶ Play</button><button class="btn" data-act="musStop">■ Stop</button></div></div>
 ${card('Where it plays', plays, { sub: 'From the where table (first rule that fits wins), the places’ own songs, the story scripts and the game’s code.' })}</div></div>`;
};
const musicLoopHTML = () =>
  `<label class="mus-loop" title="Off: a song stops after its last bar"><input type="checkbox" id="musLoop" ${musicStudio.loop ? 'checked' : ''}>Loop</label>`;
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (el && el.id === 'musLoop') musicStudio.loop = el.checked;
});
ACTIONS.musPlay = d => musicPlay(d.song);
ACTIONS.musStop = () => musicStop();
ACTIONS.musPick = d => {
  studioState.sel.musicSong = d.song;
  render();
};
