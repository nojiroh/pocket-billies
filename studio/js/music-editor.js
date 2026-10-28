'use strict';
/* ================= POCKET BILLIES STUDIO · Music & sound (sound track SND-3) =================
   game/data/music.json: the songs (a recipe each, composed by the game's own tracker), the where table that picks
   one for where you are, and the jingles. Play and loop any song through the game's tracker (game/js/audio/tracker.js)
   on the Studio's own AudioContext, made on the first press of a play button (a browser starts sound only after one).
   Every edit is heard at once: the tracker composes the song again and keeps its place. Playing stops by itself when
   the section is off screen. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { MUSIC_BATTLE_KINDS, MUSIC_WHERE_KEYS, musicWhereMatches, songFor } from '../../game/js/logic/music-where.js';
import { cryLowHealth, cryRecipe, cryVoices } from '../../game/js/logic/cries.js';
import { UI_SOUND_NAMES, uiSoundVoices } from '../../game/js/logic/ui-sounds.js';
import { ambienceNoiseLoop, ambienceRandom } from '../../game/js/logic/ambience-sound.js';
import { soundscapePreview } from '../../game/js/logic/soundscape.js';
import { soundLevels } from '../../game/js/audio/levels.js';
import { midiToFrequency, trackerCompose, trackerCreate } from '../../game/js/audio/tracker.js';
import { soundscapePlayerCreate } from '../../game/js/audio/soundscape-player.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  MUSIC_CHOICES,
  MUSIC_SCALES,
  chordNumeral,
  musicFindings,
  musicJingleList,
  musicJingleNotes,
  musicNoteName,
  musicSongUses,
} from '../../game/js/logic/music-studio.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  card,
  changed,
  checkboxField,
  commit,
  grid,
  numberField,
  rangeField,
  render,
  sectionShown,
  selectField,
  studioState,
  textField,
  writePath,
} from './studio-app.js';
import { scheduleCheck } from './check.js';
import { legacyLoad, legacyView } from './legacy-view.js';
/* eslint-disable no-func-assign */
expose({
  MUSIC_CRY_PREVIEW: [() => MUSIC_CRY_PREVIEW],
  MUSIC_JINGLE_BPM: [() => MUSIC_JINGLE_BPM],
  MUSIC_SCAPE_AT: [() => MUSIC_SCAPE_AT],
  MUSIC_SCAPE_HEIGHT: [() => MUSIC_SCAPE_HEIGHT],
  MUSIC_TABS: [() => MUSIC_TABS],
  ROLL_CELL_H: [() => ROLL_CELL_H],
  ROLL_CELL_W: [() => ROLL_CELL_W],
  ROLL_LEFT: [() => ROLL_LEFT],
  ROLL_TOP: [() => ROLL_TOP],
  musicBaseCriesHTML: [() => musicBaseCriesHTML, v => (musicBaseCriesHTML = v)],
  musicCheckFindings: [() => musicCheckFindings, v => ((musicCheckFindings = v), provide({ musicCheckFindings }))],
  musicCryCardHTML: [() => musicCryCardHTML, v => ((musicCryCardHTML = v), provide({ musicCryCardHTML }))],
  musicCryPlay: [() => musicCryPlay, v => (musicCryPlay = v)],
  musicCryTidy: [() => musicCryTidy, v => ((musicCryTidy = v), provide({ musicCryTidy }))],
  musicData: [() => musicData],
  musicEnsemblesHTML: [() => musicEnsemblesHTML, v => (musicEnsemblesHTML = v)],
  musicHookHTML: [() => musicHookHTML, v => (musicHookHTML = v)],
  musicHookMount: [() => musicHookMount, v => (musicHookMount = v)],
  musicInstrumentPlay: [() => musicInstrumentPlay, v => (musicInstrumentPlay = v)],
  musicInstrumentsHTML: [() => musicInstrumentsHTML, v => (musicInstrumentsHTML = v)],
  musicJingleHTML: [() => musicJingleHTML, v => (musicJingleHTML = v)],
  musicJingleMount: [() => musicJingleMount, v => (musicJingleMount = v)],
  musicJinglePlay: [() => musicJinglePlay, v => (musicJinglePlay = v)],
  musicJingleSelected: [() => musicJingleSelected],
  musicLine: [() => musicLine],
  musicLineSet: [() => musicLineSet, v => (musicLineSet = v)],
  musicListColHTML: [() => musicListColHTML],
  musicLoopHTML: [() => musicLoopHTML],
  musicMixApply: [() => musicMixApply, v => (musicMixApply = v)],
  musicMixHTML: [() => musicMixHTML, v => (musicMixHTML = v)],
  musicNoteHear: [() => musicNoteHear, v => (musicNoteHear = v)],
  musicNowShow: [() => musicNowShow, v => (musicNowShow = v)],
  musicPartHTML: [() => musicPartHTML],
  musicPickHTML: [() => musicPickHTML],
  musicPlay: [() => musicPlay, v => (musicPlay = v)],
  musicPlaying: [() => musicPlaying],
  musicRecipeHTML: [() => musicRecipeHTML, v => (musicRecipeHTML = v)],
  musicRollMount: [() => musicRollMount, v => (musicRollMount = v)],
  musicRollRows: [() => musicRollRows, v => (musicRollRows = v)],
  musicRunHTML: [() => musicRunHTML, v => (musicRunHTML = v)],
  musicScape: [() => musicScape, v => (musicScape = v)],
  musicScapeHTML: [() => musicScapeHTML, v => (musicScapeHTML = v)],
  musicSelected: [() => musicSelected],
  musicSongIds: [() => musicSongIds],
  musicSongListHTML: [() => musicSongListHTML, v => (musicSongListHTML = v)],
  musicStop: [() => musicStop, v => (musicStop = v)],
  musicStudio: [() => musicStudio],
  musicSummary: [() => musicSummary],
  musicTracker: [() => musicTracker, v => (musicTracker = v)],
  musicTryHTML: [() => musicTryHTML, v => (musicTryHTML = v)],
  musicUiSoundsHTML: [() => musicUiSoundsHTML, v => (musicUiSoundsHTML = v)],
  musicUses: [() => musicUses, v => (musicUses = v)],
  musicVoicesPlay: [() => musicVoicesPlay, v => (musicVoicesPlay = v)],
  musicWhereHTML: [() => musicWhereHTML, v => (musicWhereHTML = v)],
  musicWhereOptions: [() => musicWhereOptions, v => (musicWhereOptions = v)],
  musicWhereSet: [() => musicWhereSet, v => (musicWhereSet = v)],
  musicYesNoHTML: [() => musicYesNoHTML],
});
/* eslint-enable no-func-assign */
provide({ musicCheckFindings, musicCryCardHTML, musicCryTidy });
/* to-module: end */
export const musicStudio = {
  /** @type {AudioContext | null} */ ctx: null,
  /** @type {any} */ tracker: null,
  loop: true,
  /** SND-4: play songs' night versions (town@night) */ night: false,
  /** SND-5: play another version: tense or a run arc band ('' as written) */ part: '',
  /** SND-11: GB Sounds: every song on the four chip voices (the game's Settings -> Sound switch) */ gb: false,
  /** SND-11: the player's master, compressor and music bus (built from music.json mix, as the game's) */
  /** @type {any} */ chain: null,
  shown: '',
  /** the where rule last moved, added or shown (marked in the table) */ picked: -1,
  /** the line the hook roll edits: hook, counter or (SND-5) intro */ line: 'hook',
  /** Try a place: where you are, made up */
  tryState: /** @type {Record<string, any>} */ ({
    started: true,
    battle: null,
    tab: 'walk',
    indoor: false,
    nodeType: 'route',
    biome: 'lake',
    row: 2,
    placeMusic: null,
  }),
  /** SND-10: the World sounds card's player (audio/soundscape-player.js), what it plays and its timer */
  /** @type {any} */ scape: null,
};
const musicData = () => studioState.D.music;
/** the line the hook roll edits */
const musicLine = () => (['counter', 'intro'].includes(musicStudio.line) ? musicStudio.line : 'hook');
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
/* SND-11: the player's chain is the game's (sound.js initSound): the music bus, the master's trim, the compressor,
   each from music.json mix at the game's default sliders (audio/levels.js soundLevels), so a song's balance and level
   sound here as they do in the game (until SND-11 the Studio used the browser's default compressor, -24 dB at 12:1,
   against the game's -14 dB at 3:1). An edit to the mix is heard at once */
function musicMixApply() {
  const C = musicStudio.chain;
  if (!C) return;
  const mix = musicData().mix || {},
    L = soundLevels({}, mix),
    CM = mix.compressor || {};
  C.comp.threshold.value = CM.threshold ?? -14;
  C.comp.ratio.value = CM.ratio ?? 3;
  C.master.gain.value = L.master;
  C.music.gain.value = L.music;
}
function musicTracker() {
  if (musicStudio.tracker) return musicStudio.tracker;
  const AC = window.AudioContext || window.webkitAudioContext,
    ctx = new AC(),
    out = ctx.createGain(),
    master = ctx.createGain(),
    squash = ctx.createDynamicsCompressor();
  out.connect(master);
  master.connect(squash);
  squash.connect(ctx.destination);
  musicStudio.chain = { comp: squash, master, music: out };
  musicMixApply();
  /* SND-5: the run's arc as the data has it now (an edit or an undo replaces it); SND-11: the instruments, the
     ensembles as the data has them now, GB Sounds as the box beside Night says, the reverb returning to the master */
  const T = trackerCreate(ctx, out, {
    songs: musicData().songs,
    instruments: musicData().instruments,
    get ensembles() {
      return musicData().ensembles;
    },
    gb: () => musicStudio.gb,
    master,
    get run() {
      return musicData().run;
    },
  });
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
export function musicPlay(name) {
  const T = musicTracker();
  if (musicStudio.ctx.state !== 'running') musicStudio.ctx.resume().catch(() => {});
  T.refresh(musicData().songs);
  if (T.song) T.stop();
  /* SND-4: with Night on, the night version, if the song has one. SND-5: the version picked (tense, an arc
     band; night over a band, not over tense), else the song as written; its intro first */
  const S = musicData().songs[name],
    part = musicStudio.part,
    night = musicStudio.night && S && S.night !== false && part !== 'tense',
    want = name + (part ? '@' + part : '') + (night ? '@night' : '');
  if (!T.play(want, { intro: true })) T.play(night ? name + '@night' : name, { intro: true });
  musicNowShow();
}
export function musicStop() {
  if (musicStudio.tracker && musicStudio.tracker.song) musicStudio.tracker.stop();
  musicNowShow();
}
/* the line under the list: what plays, and its bar; drawn without a re-render (25 ms ticks) */
function musicNowShow() {
  const T = musicStudio.tracker,
    sg = T && T.song,
    text = sg
      ? `▶ ${sg.name} · ${sg.step < 0 ? 'intro' : `bar ${Math.floor((sg.step % sg.D.steps) / 16) + 1} of ${sg.D.steps / 16}`}`
      : 'Nothing playing';
  if (text === musicStudio.shown) return;
  musicStudio.shown = text;
  const el = document.getElementById('musNow');
  if (el) el.textContent = text;
  for (const b of document.querySelectorAll('[data-act="musPlay"]'))
    b.classList.toggle('on', !!sg && /** @type {HTMLElement} */ (b).dataset.song === sg.name.split('@')[0]);
}
/** the song playing, or '' (for the self-test and the Studio check) */
export const musicPlaying = () =>
  musicStudio.tracker && musicStudio.tracker.song ? musicStudio.tracker.song.name : '';

/* ---------- the section ---------- */
const musicSummary = S =>
  `${S.bpm} bpm · ${musicNoteName(S.key).replace(/\d+$/, '')} ${S.scale} · ${S.drums === 'none' ? 'no' : S.drums} drums`;
const musicListColHTML = uses =>
  `<div class="list-head"><div class="seg-row"><button class="btn primary" data-act="musStop">■ Stop</button>${musicLoopHTML()}</div><small id="musNow" class="mono" aria-live="polite">Nothing playing</small></div><div class="llist" id="musList">${musicSongListHTML(uses)}</div>`;
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
/* the recipe: every dial is a field on the data (undo and redo work as anywhere); each change composes the song again
   and, if it plays, it keeps playing with the change (studioState.hooks.music) */
function musicRecipeHTML(id) {
  const S = musicData().songs[id],
    p = `music.songs.${id}`,
    keys = [];
  for (let m = 40; m <= 80; m++) keys.push([m, `${musicNoteName(m)} (${m})`]);
  const chords = S.prog
    .map(
      (deg, b) =>
        `<label class="fld mus-chord"><span>Bar ${b + 1}</span><select data-p="${p}.prog.${b}" data-k="num">${[
          0, 1, 2, 3, 4, 5, 6,
        ]
          .map(
            d =>
              `<option value="${d}" ${d === deg ? 'selected' : ''}>${chordNumeral(S.scale, d)} · ${musicNoteName(S.key + MUSIC_SCALES[S.scale][d]).replace(/-?\d+$/, '')}</option>`
          )
          .join('')}</select></label>`
    )
    .join('');
  const body =
    grid(
      numberField('Tempo', `${p}.bpm`, { min: 30, max: 300, step: 1, unit: 'bpm' }),
      selectField('Key (home note)', `${p}.key`, keys, { num: 1, rr: 1 }),
      selectField('Scale', `${p}.scale`, MUSIC_CHOICES.scale, { rr: 1, help: 'The chord names below follow it.' }),
      selectField('Lead', `${p}.lead`, MUSIC_CHOICES.wave),
      selectField('Bass', `${p}.bass`, MUSIC_CHOICES.bass),
      selectField('Arpeggio', `${p}.arp`, MUSIC_CHOICES.arp),
      selectField('Drums', `${p}.drums`, MUSIC_CHOICES.drums),
      /* SND-11: the ids come from the data (music.json ensembles); gb is today's four chip voices */
      selectField(
        'Ensemble',
        `${p}.ensemble`,
        [['gb', 'gb: the four chip voices'], ...Object.keys(musicData().ensembles || {}).map(k => [k, k])],
        { opt: 1, none: 'gb (none named)', help: 'What plays the song (the Instruments tab). GB Sounds plays gb.' }
      )
    ) +
    `<div class="mus-chords">${chords}</div>` +
    grid(
      rangeField('Swing', `${p}.swing`, {
        min: 0,
        max: 0.5,
        step: 0.01,
        def: 0,
        showKey: 'pct',
        show: v => Math.round(v * 100) + '%',
      }),
      rangeField('Echo on the lead', `${p}.echo`, {
        min: 0,
        max: 1,
        step: 0.05,
        def: 0.15,
        showKey: 'pct',
        show: v => Math.round(v * 100) + '%',
      }),
      rangeField('Level trim (dB)', `${p}.trim`, {
        min: -24,
        max: 24,
        step: 0.5,
        def: 0,
        show: v => (v > 0 ? '+' : '') + v + ' dB',
        help: 'Evens the songs out with each other (tools/check-sound.py --loudness measures them); not a player setting.',
      }),
      checkboxField('Sevenths in the arpeggio', `${p}.seventh`, { num: 1 }),
      checkboxField('Music-box lead (short notes)', `${p}.pluck`),
      checkboxField('Thicker mix (more than four voices: sine chords, a night pad)', `${p}.extra`),
      `<div class="fld"><span>Seed (the tune)</span><span class="seg-row"><input type="number" data-p="${p}.seed" data-k="num" step="1" value="${S.seed}" aria-label="Seed"><button class="btn subtle" data-act="musSeed" title="Another tune over the same chords">New tune</button></span></div>`
    );
  return card('Recipe', body, {
    sub: 'The game composes the tune from this: a seeded walk over the chords; bars 5-6 repeat 1-2, bar 8 comes home. A written hook takes bars 1-2 and 5-6, and bars 3-4 answer it on their chords.',
  });
}
studioState.hooks.music = path => {
  if (path.startsWith('music.songs.') && musicStudio.tracker) musicStudio.tracker.refresh(musicData().songs);
};
ACTIONS.musSeed = () => {
  const id = musicSelected();
  writePath(`music.songs.${id}.seed`, Math.floor(Math.random() * 1000));
  changed();
  commit(true);
  if (musicStudio.tracker) musicStudio.tracker.refresh(musicData().songs);
  render();
};
/* ---------- the roll: a small piano roll on its own canvas (the hook, the countermelody, a jingle) ----------
   Columns are sixteenths, rows the scale's notes. A click on an empty cell writes a note (drag right for a longer one;
   a note it overlaps gives way); a click on a note takes it away. One line is edited, another may show faintly
   behind it (the composed tune under a hook, the hook under its counter). Each change is one undo step. */
const ROLL_CELL_W = 22,
  ROLL_CELL_H = 16,
  ROLL_LEFT = 40,
  ROLL_TOP = 18;
/** the rows: the scale's notes from low to high, `span` semitones up from `base` */
function musicRollRows(key, scale, base, span) {
  /* SND-5: 'chromatic', every semitone (an intro's runs) */
  const sc = scale === 'chromatic' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : MUSIC_SCALES[scale] || MUSIC_SCALES.major,
    out = [];
  for (let m = base; m <= base + span; m++) if (sc.includes((((m - key) % 12) + 12) % 12)) out.push(m);
  return out;
}
/**
 * draw a roll and let it be edited
 * @param {HTMLCanvasElement} cv
 * @param {{steps: number, rows: number[], home?: number, notes: number[][], ghost?: number[][], labels?: string[], onChange: (notes: number[][]) => void, onNote?: (midi: number) => void}} o
 */
function musicRollMount(cv, o) {
  const W = ROLL_LEFT + o.steps * ROLL_CELL_W,
    H = ROLL_TOP + o.rows.length * ROLL_CELL_H,
    dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
  let notes = o.notes.map(n => [...n]),
    drag = null;
  const css = getComputedStyle(cv),
    col = k => css.getPropertyValue(k).trim() || '#888';
  const rowOf = m => o.rows.length - 1 - o.rows.indexOf(m);
  const draw = () => {
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.font = '10px ui-monospace, monospace';
    o.rows.forEach((m, i) => {
      const y = ROLL_TOP + (o.rows.length - 1 - i) * ROLL_CELL_H;
      g.fillStyle = o.home != null && (((m - o.home) % 12) + 12) % 12 === 0 ? col('--acc2') : col('--panel');
      g.fillRect(ROLL_LEFT, y, W - ROLL_LEFT, ROLL_CELL_H);
      g.fillStyle = col('--text2');
      g.fillText(musicNoteName(m), 2, y + 12);
    });
    for (let st = 0; st <= o.steps; st++) {
      g.fillStyle = st % 16 === 0 ? col('--line2') : st % 4 === 0 ? col('--line') : col('--panel2');
      g.fillRect(ROLL_LEFT + st * ROLL_CELL_W, ROLL_TOP, st % 4 === 0 ? 1.5 : 1, H - ROLL_TOP);
    }
    (o.labels || []).forEach((t, b) => {
      g.fillStyle = col('--text2');
      g.fillText(t, ROLL_LEFT + b * 16 * ROLL_CELL_W + 4, 12);
    });
    const bar = (n, fill, alpha) => {
      const r = rowOf(n[1]);
      if (r < 0 || r >= o.rows.length) return;
      g.globalAlpha = alpha;
      g.fillStyle = fill;
      g.fillRect(
        ROLL_LEFT + n[0] * ROLL_CELL_W + 1,
        ROLL_TOP + r * ROLL_CELL_H + 2,
        n[2] * ROLL_CELL_W - 2,
        ROLL_CELL_H - 4
      );
      g.globalAlpha = 1;
    };
    for (const n of o.ghost || []) bar(n, col('--text2'), 0.25);
    for (const n of notes) bar(n, col('--acc'), 1);
  };
  const cell = ev => {
    const r = cv.getBoundingClientRect(),
      x = ev.clientX - r.left - ROLL_LEFT,
      y = ev.clientY - r.top - ROLL_TOP;
    const st = Math.floor(x / ROLL_CELL_W),
      row = Math.floor(y / ROLL_CELL_H);
    if (st < 0 || st >= o.steps || row < 0 || row >= o.rows.length) return null;
    return { st, midi: o.rows[o.rows.length - 1 - row] };
  };
  /* a note written over others: the ones it overlaps go */
  const place = n => notes.filter(m => m === n || m[0] + m[2] <= n[0] || m[0] >= n[0] + n[2]);
  cv.addEventListener('pointerdown', ev => {
    const c = cell(ev);
    if (!c) return;
    ev.preventDefault();
    const hit = notes.find(n => n[1] === c.midi && c.st >= n[0] && c.st < n[0] + n[2]);
    if (hit) {
      notes = notes.filter(n => n !== hit);
      draw();
      o.onChange(notes);
      return;
    }
    const n = [c.st, c.midi, 2 > o.steps - c.st ? 1 : 2];
    notes.push(n);
    notes = place(n);
    drag = n;
    cv.setPointerCapture(ev.pointerId);
    if (o.onNote) o.onNote(c.midi);
    draw();
  });
  cv.addEventListener('pointermove', ev => {
    if (!drag) return;
    const r = cv.getBoundingClientRect(),
      st = Math.floor((ev.clientX - r.left - ROLL_LEFT) / ROLL_CELL_W);
    const len = Math.max(1, Math.min(o.steps - drag[0], st - drag[0] + 1));
    if (len !== drag[2]) {
      drag[2] = len;
      draw();
    }
  });
  const end = () => {
    if (!drag) return;
    notes = place(drag);
    drag = null;
    draw();
    o.onChange(notes.sort((a, b) => a[0] - b[0]));
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  draw();
}
/** a note heard as it is written, on the section's tracker */
function musicNoteHear(midi, type = 'p25') {
  const T = musicTracker();
  if (musicStudio.ctx.state !== 'running') musicStudio.ctx.resume().catch(() => {});
  T.synthVoice(T.bus, {
    type,
    freq: midiToFrequency(midi),
    t: musicStudio.ctx.currentTime + 0.02,
    dur: 0.18,
    vol: 0.09,
  });
}

/* ---------- the hook card ---------- */
function musicHookHTML(id) {
  const S = musicData().songs[id],
    line = musicLine(),
    has = k => (S[k] || []).length;
  const tabs = [
    ['hook', `Hook${has('hook') ? ` (${has('hook')})` : ''}`],
    ['counter', `Countermelody${has('counter') ? ` (${has('counter')})` : ''}`],
    ['intro', `Intro${has('intro') ? ` (${has('intro')})` : ''}`],
  ]
    .map(
      ([k, n]) =>
        `<button class="seg ${k === line ? 'on' : ''}" data-act="musLine" data-l="${k}" aria-pressed="${k === line}">${n}</button>`
    )
    .join('');
  return card(
    'Hook',
    textField('Name', `music.songs.${id}.hookName`, {
      opt: 1,
      ph: 'unnamed',
      help: 'One name for the hook, its countermelody and the intro. Claude’s drafts start with “placeholder”; the Check lists them until you rename them.',
    }) +
      `<div class="seg-row">${tabs}<span class="grow"></span><button class="btn subtle" data-act="musHookFromTune" ${line === 'hook' ? '' : 'hidden'} title="Start from the composed tune’s first two bars">Copy the tune’s bars 1-2</button><button class="btn subtle" data-act="musLineClear" ${has(line) ? '' : 'disabled'}>Clear</button></div>
<div class="mus-roll-wrap"><canvas id="musRoll" class="mus-roll" aria-label="${line === 'hook' ? 'Hook' : line === 'intro' ? 'Intro' : 'Countermelody'} roll, 32 sixteenths: ${(S[line] || []).map(n => musicNoteName(n[1]) + ' at ' + (n[0] + 1)).join(', ') || 'empty'}"></canvas></div>`,
    {
      sub:
        line === 'hook'
          ? 'Two bars the game plays instead of its own tune in bars 1-2 and again in 5-6. The faint notes are the composed tune; an empty hook keeps it.'
          : line === 'intro'
            ? 'One or two bars on the lead alone, played once before the song when a battle starts it (the chromatic run), with the drums held until the first throw. Every semitone is a row. ▶ Play starts with it.'
            : 'A second, quieter line under bars 1-2 and 5-6. The faint notes are the lead it plays against.',
    }
  );
}
function musicHookMount(id) {
  const cv = /** @type {HTMLCanvasElement | null} */ (document.getElementById('musRoll'));
  if (!cv) return;
  const S = musicData().songs[id],
    line = musicLine(),
    C = trackerCompose(S),
    base = S.key >= 64 ? S.key - 12 : S.key;
  const lead = [];
  for (let st = 0; st < 32; st++) if (C.notes[st]) lead.push([st, C.notes[st][0], C.notes[st][1]]);
  musicRollMount(cv, {
    steps: 32,
    /* the composed tune walks from the octave above the key up to about an octave and a half over it */
    rows:
      line === 'intro' ? musicRollRows(S.key, 'chromatic', base - 2, 30) : musicRollRows(S.key, S.scale, base + 5, 26),
    home: S.key,
    notes: S[line] || [],
    ghost: line === 'hook' && !(S.hook || []).length ? lead : line === 'counter' ? lead : [],
    labels:
      line === 'intro'
        ? ['intro bar 1', 'intro bar 2']
        : [0, 1].map(b => `bar ${b + 1}: ${chordNumeral(S.scale, S.prog[b])}`),
    onNote: m => musicNoteHear(m, line === 'hook' ? S.lead : 'p12'),
    onChange: notes => musicLineSet(id, line, notes),
  });
}
function musicLineSet(id, line, notes) {
  const S = musicData().songs[id];
  if (notes.length) S[line] = notes.map(n => [n[0], n[1], n[2]]);
  else delete S[line];
  changed();
  commit(true);
  if (musicStudio.tracker) musicStudio.tracker.refresh(musicData().songs);
  render();
}
ACTIONS.musLine = d => {
  musicStudio.line = d.l;
  render();
};
ACTIONS.musLineClear = () => musicLineSet(musicSelected(), musicLine(), []);
ACTIONS.musHookFromTune = () => {
  const id = musicSelected(),
    C = trackerCompose(musicData().songs[id]),
    out = [];
  for (let st = 0; st < 32; st++) if (C.notes[st]) out.push([st, C.notes[st][0], C.notes[st][1]]);
  musicLineSet(id, 'hook', out);
};

/* ---------- the jingles: short tunes that play once (a win, a level up, a catch...) ----------
   A jingle is a list of [midi, sixteenths] one after another, 0 a rest; on the roll it is notes on a timeline. The
   game plays them at 150 bpm on a 25 % pulse with a triangle an octave down (the level up at 180 in battle). SND-6: a
   jingle may set its own tempo and wave (the run's beats do; sound.js jinglePlay) */
const MUSIC_JINGLE_BPM = 150;
const musicJingleSelected = () => {
  const ids = Object.keys(musicData().jingles || {});
  if (!ids.includes(studioState.sel.musicJingle)) studioState.sel.musicJingle = ids[0];
  return studioState.sel.musicJingle;
};
function musicJingleHTML() {
  const J = musicData().jingles || {},
    cur = musicJingleSelected();
  if (!cur) return card('Jingles', '<p class="help">music.json has no jingles.</p>');
  const len = J[cur].notes.reduce((a, n) => a + n[1], 0);
  const picks = Object.keys(J)
    .map(
      k =>
        `<span class="mus-jpick"><button class="btn subtle mus-play" data-act="musJinglePlay" data-j="${escapeHtml(k)}" aria-label="Play ${escapeHtml(k)}" title="Play ${escapeHtml(k)}">▶</button><button class="seg ${k === cur ? 'on' : ''}" data-act="musJinglePick" data-j="${escapeHtml(k)}" aria-pressed="${k === cur}">${escapeHtml(k)}</button></span>`
    )
    .join('');
  return card(
    'Jingles',
    `<div class="seg-row">${picks}</div>
<div class="seg-row"><b>${escapeHtml(cur)}</b><small class="help">${len} sixteenths · ${J[cur].notes.filter(n => n[0]).length} notes</small><span class="grow"></span><button class="btn primary" data-act="musJinglePlay" data-j="${escapeHtml(cur)}">▶ Play</button></div>
${textField('Name', `music.jingles.${cur}.name`, { opt: 1, ph: 'unnamed', help: 'Claude’s drafts start with “placeholder”; the Check lists them until you rename them.' })}
${grid(numberField('Tempo', `music.jingles.${cur}.bpm`, { opt: 1, min: 40, max: 400, step: 1, unit: 'bpm', ph: `${MUSIC_JINGLE_BPM}` }), selectField('Wave', `music.jingles.${cur}.wave`, MUSIC_CHOICES.wave, { opt: 1, none: 'Pulse 25 % (as most)' }))}
<div class="mus-roll-wrap"><canvas id="musJRoll" class="mus-roll" aria-label="${escapeHtml(cur)} roll: ${J[cur].notes.map(n => (n[0] ? musicNoteName(n[0]) : 'rest') + ' ' + n[1]).join(', ')}"></canvas></div>`,
    {
      sub: 'One note at a time, in sixteenths; a gap is a rest. With a triangle an octave down, at 150 bpm on a 25 % pulse unless it sets its own tempo and wave (the battle’s level up plays at 180). They play on Sound effects.',
    }
  );
}
function musicJingleMount() {
  const cv = /** @type {HTMLCanvasElement | null} */ (document.getElementById('musJRoll')),
    id = musicJingleSelected();
  if (!cv || !id) return;
  const list = musicData().jingles[id].notes,
    len = list.reduce((a, n) => a + n[1], 0);
  musicRollMount(cv, {
    steps: Math.max(16, Math.ceil((len + 4) / 4) * 4),
    rows: musicRollRows(60, 'major', 60, 31),
    home: 60,
    notes: musicJingleNotes(list),
    onNote: m => musicNoteHear(m),
    onChange: notes => {
      if (!notes.length) return render();
      musicData().jingles[id].notes = musicJingleList(notes);
      changed();
      commit(true);
      render();
    },
  });
}
function musicJinglePlay(id) {
  const T = musicTracker(),
    J = musicData().jingles[id];
  if (!J) return;
  if (musicStudio.ctx.state !== 'running') musicStudio.ctx.resume().catch(() => {});
  T.jingle(J.notes, J.bpm || MUSIC_JINGLE_BPM, J.wave || 'p25', T.bus);
}
ACTIONS.musJinglePlay = d => musicJinglePlay(d.j);
ACTIONS.musJinglePick = d => {
  studioState.sel.musicJingle = d.j;
  render();
};

/* ---------- a Billy's cry (the Billies page) ----------
   Gen 1 style: a base (music.json cries.bases, SND-6: a kind such as beast), a pitch and a length per stage (lines/*.json cry); what a stage leaves
   out comes from its id, as before (logic/cries.js). Played on the music section's AudioContext */
function musicCryCardHTML(L, li, st) {
  const bases = ((studioState.D.music || {}).cries || {}).bases || {},
    sp = L.id + st,
    own = (L.cry || [])[st] || null,
    made = cryRecipe(sp, null, bases),
    p = `lines.${li}.cry.${st}`;
  const body =
    grid(
      selectField(
        'Base cry',
        `${p}.base`,
        Object.keys(bases).map(k => [k, `${k} · ${bases[k].wave}`]),
        { opt: 1, none: `From its id (${made.base})`, help: 'The kind of cry (Music & sound → Sounds plays each one).' }
      ),
      numberField('Pitch', `${p}.pitch`, {
        opt: 1,
        min: 24,
        max: 96,
        step: 1,
        ph: `${made.pitch} (${musicNoteName(made.pitch)}, from its id)`,
        help: 'The first note, as a midi note (60 is middle C).',
      }),
      numberField('Length', `${p}.length`, { opt: 1, min: 0.25, max: 4, step: 0.05, ph: '1 (from its id)', unit: '×' }),
      textField('Name', `${p}.name`, {
        opt: 1,
        ph: 'unnamed',
        help: 'Claude’s drafts start with “placeholder”; the Check lists them until you rename them.',
      })
    ) +
    `<div class="seg-row"><button class="btn primary" data-act="musCry" data-sp="${escapeHtml(sp)}" data-li="${li}" data-st="${st}">▶ Cry</button><button class="btn" data-act="musCry" data-sp="${escapeHtml(sp)}" data-li="${li}" data-st="${st}" data-low="1" title="A preview: what the game does with it comes in SND-6">▶ Low on health</button>${own ? `<button class="btn subtle" data-act="musCryReset" data-li="${li}" data-st="${st}">Use the cry its id makes</button>` : ''}</div>`;
  return card('Cry', body, {
    sub: own
      ? 'This stage has its own cry. Empty fields still come from its id.'
      : 'Made from its id (every Billy’s is, until you set one). Set a base, pitch or length to give this stage its own.',
  });
}
/* a stage's cry with nothing in it goes back to null, and a line with no cries loses the list */
function musicCryTidy(li) {
  const L = studioState.D.lines[li];
  if (!L || !Array.isArray(L.cry)) return;
  L.cry = L.cry.map(C => (C && Object.keys(C).some(k => C[k] !== undefined) ? C : null));
  while (L.cry.length && !L.cry[L.cry.length - 1]) L.cry.pop();
  if (!L.cry.length) delete L.cry;
}
function musicCryPlay(li, st, low) {
  const T = musicTracker(),
    L = studioState.D.lines[li],
    C0 = cryRecipe(L.id + st, (L.cry || [])[st], ((studioState.D.music || {}).cries || {}).bases || {}),
    t = musicStudio.ctx.currentTime + 0.03;
  if (musicStudio.ctx.state !== 'running') musicStudio.ctx.resume().catch(() => {});
  for (const v of cryVoices(low ? cryLowHealth(C0) : C0))
    T.synthVoice(T.bus, {
      type: v.type,
      freq: midiToFrequency(v.midi),
      t: t + v.at,
      dur: v.dur,
      vol: v.vol,
      slide: v.slide,
      vib: v.vib,
    });
}
ACTIONS.musCry = d => musicCryPlay(+d.li, +d.st, !!d.low);
ACTIONS.musCryReset = d => {
  const L = studioState.D.lines[+d.li];
  if (L && L.cry) L.cry[+d.st] = null;
  musicCryTidy(+d.li);
  changed();
  commit(true);
  render();
};

/* ---------- SND-6: the Sounds tab: the base cries, the buttons' four sounds, the mix (SND-10: and the world's water) ---------- */
const MUSIC_CRY_PREVIEW = 60;
/** a few notes (a base cry's or a UI sound's) on the Studio's own context, from now @param {{at: number, midi: number, type: string, dur: number, vol: number, slide?: number, vib?: number}[]} V */
function musicVoicesPlay(V) {
  const T = musicTracker(),
    t = musicStudio.ctx.currentTime + 0.03;
  if (musicStudio.ctx.state !== 'running') musicStudio.ctx.resume().catch(() => {});
  for (const v of V)
    T.synthVoice(T.bus, {
      type: v.type,
      freq: midiToFrequency(v.midi),
      t: t + v.at,
      dur: v.dur,
      vol: v.vol,
      slide: v.slide || 0,
      vib: v.vib || 0,
    });
}
function musicBaseCriesHTML() {
  const B = (musicData().cries || {}).bases || {};
  const rows = Object.keys(B)
    .map(k => {
      const p = `music.cries.bases.${k}`,
        voices = B[k].voices
          .map(
            (v, i) =>
              `<div class="grid">${[
                ['Starts', 'at', { min: 0, max: 2, step: 0.01, unit: 's' }],
                ['Note', 'note', { min: -24, max: 24, step: 1, unit: '+st' }],
                ['Length', 'len', { min: 0.01, max: 2, step: 0.01, unit: 's' }],
                ['Volume', 'vol', { opt: 1, min: 0, max: 0.2, step: 0.005, ph: '0.06' }],
                ['Slide', 'slide', { opt: 1, min: 0.1, max: 4, step: 0.05, ph: '1', unit: '×' }],
                ['Wobble', 'vib', { opt: 1, min: 0, max: 10, step: 0.5, ph: '0' }],
              ]
                .map(([n, f, o]) => numberField(`${i + 1}: ${n}`, `${p}.voices.${i}.${f}`, o))
                .join(
                  ''
                )}${selectField(`${i + 1}: Wave`, `${p}.voices.${i}.wave`, MUSIC_CHOICES.wave, { opt: 1, none: 'the base’s' })}</div>`
          )
          .join('');
      return `<details class="mus-cry" id="musCry_${escapeHtml(k)}"><summary><button class="btn subtle mus-play" data-act="musBaseCry" data-k="${escapeHtml(k)}" aria-label="Play ${escapeHtml(k)}" title="Play ${escapeHtml(k)} at middle C">▶</button><b>${escapeHtml(k)}</b> <small class="help">${escapeHtml(B[k].name || '')}</small></summary>${grid(textField('Name', `${p}.name`, { opt: 1, ph: 'unnamed' }), selectField('Wave', `${p}.wave`, MUSIC_CHOICES.wave))}${voices}<div class="seg-row"><button class="btn" data-act="musBaseCry" data-k="${escapeHtml(k)}" data-low="1">▶ Low on health</button></div></details>`;
    })
    .join('');
  return card('Base cries', rows, {
    sub: 'Each Billie names one of these kinds in its Cry card and sets its own pitch and length. A note starts a few hundredths of a second in, a number of semitones over the Billie’s pitch; the Billie’s length stretches when and how long. ▶ plays it at middle C. Low on health: a quarter faster and a minor third down.',
  });
}
function musicUiSoundsHTML() {
  const U = musicData().ui;
  if (!U) return '';
  const rows = UI_SOUND_NAMES.map(
    k =>
      `<div class="seg-row"><button class="btn subtle mus-play" data-act="musUiSound" data-k="${k}" aria-label="Play ${k}" title="Play ${k}">▶</button><b>${k}</b><span class="grow">${textField('Name', `music.ui.sounds.${k}.name`, { opt: 1, ph: 'unnamed' })}</span></div>`
  ).join('');
  const which = ['confirm', 'cancel']
    .map(
      k =>
        `<p class="help"><b>${k}</b>: buttons of class ${escapeHtml(((U[k] || {}).classes || []).join(', ') || 'none')}; actions ${escapeHtml(((U[k] || {}).actions || []).join(', ') || 'none')}</p>`
    )
    .join('');
  return card('Button sounds', rows + which, {
    sub: 'Every button makes one: can’t when it is disabled, else cancel or confirm by its class or action (listed below; music.json ui), else select. Then the UI’s own four (UI-16a): sheet when a sheet opens, flip when a pick card turns over, count when a number finishes ticking up, toast when a notice drops in. stamp is the thunk of a Bureau stamp landing (SY-3). Their notes are in music.json ui.',
  });
}
function musicMixHTML() {
  const p = 'music.mix';
  return card(
    'Mix',
    grid(
      ...[
        ['Master', 'master', 'Headroom for the compressor after it'],
        ['Music', 'music', ''],
        ['Sound effects', 'sfx', 'Jingles, cries and the buttons'],
        ['World sounds', 'world', 'Water, fire, rain, animals'],
        ['Ambience', 'amb', 'Birds, crickets, a town'],
      ].map(([n, k, h]) =>
        numberField(n, `${p}.${k}`, { opt: 1, min: 0, max: 1.5, step: 0.05, unit: '×', help: h || undefined })
      ),
      numberField('Beds under a song', `${p}.bedsUnderSong`, {
        opt: 1,
        min: -24,
        max: 0,
        step: 0.5,
        unit: 'dB',
        help: 'World sounds and ambience come down this much while a song plays (not the title or the fall)',
      }),
      numberField('Compressor threshold', `${p}.compressor.threshold`, {
        opt: 1,
        min: -60,
        max: 0,
        step: 1,
        unit: 'dB',
      }),
      numberField('Compressor ratio', `${p}.compressor.ratio`, { opt: 1, min: 1, max: 20, step: 0.5, unit: ': 1' })
    ),
    {
      sub: 'Each bus’s trim, times the square of its slider in the game’s Settings → Sound. The game uses these; the Studio’s own player does not, so try a change in the game.',
    }
  );
}
/* ---------- SND-10: the world's water at a distance (soundscape.json water; audio/soundscape-player.js) ----------
   the game's own player on the Studio's context, a recipe at 1, 3 or 10 m (a fall at its height), as the game's Sound
   test plays it; the level is the Studio's, not the game's World slider */
const MUSIC_SCAPE_AT = [1, 3, 10];
const MUSIC_SCAPE_HEIGHT = /** @type {Record<string, number>} */ ({ fallSmall: 1.5, fallTall: 6, plunge: 6 });
function musicScapeHTML() {
  const S = studioState.D.soundscape;
  if (!S || !S.water) return '';
  const on = musicStudio.scape && musicStudio.scape.want;
  const rows = Object.keys(S.water)
    .map(
      k =>
        `<div class="seg-row"><b class="grow">${escapeHtml(k)}</b>${MUSIC_SCAPE_AT.map(
          d =>
            `<button class="btn subtle${on && on.id === k && on.d === d ? ' on' : ''}" data-act="musScape" data-k="${escapeHtml(k)}" data-d="${d}" aria-label="Play ${escapeHtml(k)} ${d} m away">▶ ${d} m</button>`
        ).join('')}</div>`
    )
    .join('');
  return card(
    'World sounds',
    `${rows}<div class="seg-row"><button class="btn" data-act="musScapeStop">■ Stop</button></div>`,
    {
      sub: 'Each water recipe in soundscape.json at a distance (a fall at its height: small 1.5 m, tall and its pool 6 m), through the game’s own player. Its level here is the Studio’s; the game’s World slider and the loudness report (tools/check-sound.py --loudness) say how it sits under a song.',
    }
  );
}
/** the player on the Studio's context, made once: the beds' noise, the water's banks baked in the tracker's slices */
function musicScape() {
  if (musicStudio.scape) return musicStudio.scape;
  const T = musicTracker(),
    c = /** @type {AudioContext} */ (musicStudio.ctx),
    buf = (/** @type {Float32Array} */ d) => {
      const b = c.createBuffer(1, d.length, c.sampleRate);
      b.getChannelData(0).set(d);
      return b;
    },
    env = {
      get S() {
        return studioState.D.soundscape;
      },
      noise: {
        pink: buf(ambienceNoiseLoop('pink', c.sampleRate, 6, 0x50d1)),
        brown: buf(ambienceNoiseLoop('brown', c.sampleRate, 8, 0x50d2)),
      },
      out: T.bus,
      tracker: T,
      rng: ambienceRandom(0x50d4),
    };
  T.bankAdd(env.S.banks);
  const P = soundscapePlayerCreate(c, env);
  T.bankReady(P.banks());
  musicStudio.scape = { P, want: null, timer: 0 };
  return musicStudio.scape;
}
ACTIONS.musScape = d => {
  const M = musicScape(),
    dist = +d.d;
  if (musicStudio.ctx && musicStudio.ctx.state !== 'running') musicStudio.ctx.resume().catch(() => {});
  M.want = { id: d.k, d: dist };
  clearInterval(M.timer);
  /* every 200 ms, as the game's updateAmbience; off screen it stops */
  M.timer = setInterval(() => {
    if (!sectionShown('music') || !M.want) return ACTIONS.musScapeStop({});
    M.P.update(
      soundscapePreview(studioState.D.soundscape, [[M.want.id, M.want.d, MUSIC_SCAPE_HEIGHT[M.want.id] || 0]]),
      /** @type {AudioContext} */ (musicStudio.ctx).currentTime
    );
  }, 200);
  render();
};
ACTIONS.musScapeStop = () => {
  const M = musicStudio.scape;
  if (!M) return;
  M.want = null;
  M.P.update([], /** @type {AudioContext} */ (musicStudio.ctx).currentTime);
  /* a few more updates, so the voices fade and stop */
  clearInterval(M.timer);
  let n = 0;
  M.timer = setInterval(() => {
    M.P.update([], /** @type {AudioContext} */ (musicStudio.ctx).currentTime);
    if (++n > 20) clearInterval(M.timer);
  }, 200);
  if (sectionShown('music')) render();
};
ACTIONS.musBaseCry = d => {
  const B = ((musicData().cries || {}).bases || {})[d.k];
  if (!B) return;
  const C = cryRecipe('x', { base: d.k, pitch: MUSIC_CRY_PREVIEW, length: 1 }, musicData().cries.bases);
  musicVoicesPlay(cryVoices(d.low ? cryLowHealth(C) : C));
};
ACTIONS.musUiSound = d => {
  const S = ((musicData().ui || {}).sounds || {})[d.k];
  if (S) musicVoicesPlay(uiSoundVoices(S));
};

/* ---------- the Check (studio/js/check.js) ----------
   the music's errors and warnings (logic/music-studio.js musicFindings, the errors check-data reports too) and one
   note on the cries. A song only parked places play is not called unused, so the warnings wait for the parked world */
function musicCheckFindings() {
  const D = studioState.D,
    out = [];
  if (!D.music) return out;
  if (!legacyView.data && !legacyView.loading && !legacyView.error) legacyLoad().then(() => scheduleCheck());
  const parked = legacyView.data ? legacyView.data.locations || [] : [];
  for (const f of musicFindings(D.music, {
    nodeTypes: D.nodeTypes || {},
    biomes: D.biomes || {},
    locations: [...(D.locations || []), ...parked],
    scriptText: JSON.stringify([D.story, D.trainers, D.cutscenes, legacyView.data ? legacyView.data.trainers : null]),
    lines: D.lines,
  })) {
    if (f.lvl === 'warn' && !legacyView.data) continue;
    const sel = f.song
      ? { musicTab: 'songs', musicSong: f.song }
      : f.jingle
        ? { musicTab: 'jingles', musicJingle: f.jingle }
        : f.rule != null
          ? { musicTab: 'where', musicRule: f.rule }
          : {};
    /* SND-6: the Billies' own cries are edited on the Billies page; the base cries on the Sounds tab */
    if (/^placeholder Billie cries/.test(f.msg)) {
      out.push({ lvl: f.lvl, msg: `Music: ${f.msg}`, go: 'billionaires', sel: {} });
      continue;
    }
    if (f.cry) Object.assign(sel, { musicTab: 'sounds', musicCry: f.cry });
    out.push({ lvl: f.lvl, msg: `Music: ${f.msg}`, go: f.place ? 'world' : 'music', sel: f.place ? {} : sel });
  }
  const species = D.lines.flatMap(L => L.names.map((n, i) => (L.cry || [])[i])),
    own = species.filter(Boolean).length;
  if (own < species.length)
    out.push({
      lvl: 'info',
      msg: `Cries: ${species.length - own} of ${species.length} Billies use the cry their id makes. Set one in a Billy’s Cry card.`,
      go: 'billionaires',
      sel: {},
    });
  return out;
}

/* ---------- the where table ---------- */
/* a rule's keys as the table edits them: yes/no keys, lists, a row range; an empty choice takes the key away (any) */
const MUSIC_TABS = ['walk', 'map', 'profile'];
function musicWhereOptions() {
  const D = studioState.D,
    W = musicData().where;
  return {
    battle: MUSIC_BATTLE_KINDS,
    tab: [...new Set([...MUSIC_TABS, ...W.map(w => w.tab).filter(Boolean)])],
    placeKind: ['city', 'town'],
    nodeType: Object.keys(D.nodeTypes || {}),
    biome: Object.keys(D.biomes || {}),
    song: ['$place', ...musicSongIds()],
  };
}
const musicPickHTML = (attr, value, opts, anyText = 'any') =>
  `<select ${attr}>${anyText === null ? '' : `<option value="">${anyText}</option>`}${opts.map(o => `<option value="${escapeHtml(o)}" ${String(value) === o ? 'selected' : ''}>${escapeHtml(o === '$place' ? 'the place’s own' : o)}</option>`).join('')}</select>`;
const musicYesNoHTML = (attr, value, yes, no, any = true) =>
  `<select ${attr}>${any ? '<option value="">any</option>' : ''}<option value="true" ${value === true ? 'selected' : ''}>${yes}</option><option value="false" ${value === false ? 'selected' : ''}>${no}</option></select>`;
function musicWhereHTML() {
  const W = musicData().where,
    O = musicWhereOptions(),
    last = W.length - 1;
  const LABEL = {
    started: 'game',
    battle: 'battle',
    tab: 'tab',
    indoor: 'room',
    map: 'maps',
    placeKind: 'place',
    nodeType: 'node',
    biome: 'biome',
    row: 'rows',
  };
  const rows = W.map((w, i) => {
    const a = k => `data-mw="${i}" data-mk="${k}" aria-label="Rule ${i + 1}: ${LABEL[k] || k}"`;
    const control = k =>
      k === 'started'
        ? musicYesNoHTML(a(k), w[k], 'in the game', 'before it starts', false)
        : k === 'indoor'
          ? musicYesNoHTML(a(k), w[k], 'indoors', 'outdoors', false)
          : k === 'map'
            ? `<input type="text" ${a(k)} value="${escapeHtml(w.map.join(', '))}" size="14">`
            : k === 'row'
              ? `<input type="number" min="0" step="1" ${a('row0')} value="${w.row[0]}">–<input type="number" min="0" step="1" ${a('row1')} value="${w.row[1]}">`
              : musicPickHTML(a(k), w[k], O[k], null);
    const conds = MUSIC_WHERE_KEYS.filter(k => w[k] !== undefined)
      .map(
        k =>
          `<span class="mus-cond"><small>${LABEL[k]}</small>${control(k)}<button class="x" data-act="musCondDel" data-i="${i}" data-k="${k}" title="Leave ${LABEL[k]} out" aria-label="Rule ${i + 1}: leave ${LABEL[k]} out">✕</button></span>`
      )
      .join('');
    const free = MUSIC_WHERE_KEYS.filter(k => w[k] === undefined),
      add = free.length
        ? `<select data-mw="${i}" data-mk="+" aria-label="Rule ${i + 1}: add a condition"><option value="">+ condition</option>${free.map(k => `<option value="${k}">${LABEL[k]}</option>`).join('')}</select>`
        : '';
    return `<tr class="${musicStudio.picked === i ? 'mus-hit' : ''}" id="musRule${i}"><th>${i + 1}</th><td class="mus-when"><div>${conds || '<em>everywhere</em>'}${add}</div></td><td>${musicPickHTML(a('song'), w.song, O.song, null)}</td>
<td class="mus-acts"><button class="btn subtle" data-act="musRulePlay" data-i="${i}" ${w.song === '$place' ? 'disabled title="Plays the place’s own song: try a place below"' : `title="Play ${escapeHtml(w.song)}"`} aria-label="Play rule ${i + 1}’s song">▶</button><button class="btn subtle" data-act="musRuleMove" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} title="Earlier (it wins over the rules after it)" aria-label="Move rule ${i + 1} up">↑</button><button class="btn subtle" data-act="musRuleMove" data-i="${i}" data-d="1" ${i === last ? 'disabled' : ''} title="Later" aria-label="Move rule ${i + 1} down">↓</button><button class="x" data-act="musRuleDel" data-i="${i}" ${W.length < 2 ? 'disabled' : ''} title="Remove this rule" aria-label="Remove rule ${i + 1}">✕</button></td></tr>`;
  }).join('');
  const table = `<div class="mus-where-wrap"><table class="tbl mus-where"><thead><tr><th>#</th><th>When</th><th>Song</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
<div class="seg-row"><button class="btn" data-act="musRuleAdd">+ Add a rule</button><small class="help">New rules go before the last one, which must fit everywhere so something always plays.</small></div>`;
  return (
    musicTryHTML() +
    card('Where each song plays', table, {
      sub: 'Read from the top: the first rule whose every condition fits where you are picks the song; a rule with none fits everywhere.',
    }) +
    musicRunHTML()
  );
}
/* SND-5: the run's music: the arc's bands (a biome's song busier in later rows), the map song's
   weather. Fields on music.json run; ▶ Play with Version set to a band plays it */
function musicRunHTML() {
  const R = musicData().run;
  if (!R) return '';
  const p = 'music.run',
    bands = (R.arc || [])
      .map((B, i) =>
        grid(
          textField('Band', `${p}.arc.${i}.name`, { help: 'Its name: the song plays as meadow@' + escapeHtml(B.name) }),
          numberField('From row', `${p}.arc.${i}.row.0`, { min: 0, max: 20, step: 1 }),
          numberField('To row', `${p}.arc.${i}.row.1`, { min: 0, max: 20, step: 1 }),
          selectField('Drums', `${p}.arc.${i}.changes.drums`, MUSIC_CHOICES.drums, { opt: 1, none: 'as written' }),
          numberField('Arp octaves up', `${p}.arc.${i}.changes.arpOctave`, { min: 0, max: 2, step: 1, opt: 1 }),
          checkboxField('A counter from the hook', `${p}.arc.${i}.changes.counterAuto`)
        )
      )
      .join(''),
    weather = Object.keys(R.weather || {})
      .map(w => numberField(w, `${p}.weather.${w}`, { min: 200, max: 20000, step: 100, unit: 'Hz' }))
      .join('');
  return card('In a run', `<h4>The arc</h4>${bands}<h4>The map song hears the forecast</h4>${grid(weather)}`, {
    sub: 'Row 0 is the landing; the mini-bosses stand on rows 3 and 6. A biome’s song plays as written on rows no band names, a town node always does. Battles keep their own songs (and their tense version in the red zone).',
  });
}
/* try a place: a made-up state, the rule that wins and its song */
function musicTryHTML() {
  const t = musicStudio.tryState,
    O = musicWhereOptions(),
    a = k => `data-mt="${k}" aria-label="Try: ${k}"`;
  const W = musicData().where,
    i = W.findIndex(
      w => musicWhereMatches(w, t) && (w.song !== '$place' || (t.placeMusic && musicData().songs[t.placeMusic]))
    ),
    song = songFor(t, W, musicData().songs);
  const body = `<div class="mus-try">
<label class="fld"><span>Game</span>${musicYesNoHTML(a('started'), t.started, 'in the game', 'before it starts', false)}</label>
<label class="fld"><span>Battle</span>${musicPickHTML(a('battle'), t.battle, O.battle, 'none')}</label>
<label class="fld"><span>Tab</span>${musicPickHTML(a('tab'), t.tab, O.tab, null)}</label>
<label class="fld"><span>Room</span>${musicYesNoHTML(a('indoor'), t.indoor, 'indoors', 'outdoors', false)}</label>
<label class="fld"><span>Node</span>${musicPickHTML(a('nodeType'), t.nodeType, O.nodeType, 'not in a run')}</label>
<label class="fld"><span>Biome</span>${musicPickHTML(a('biome'), t.biome, O.biome, 'none')}</label>
<label class="fld"><span>Row</span><input type="number" min="0" step="1" ${a('row')} value="${t.row ?? ''}" placeholder="none"></label>
<label class="fld"><span>Place’s own song</span>${musicPickHTML(a('placeMusic'), t.placeMusic, musicSongIds(), 'none')}</label>
</div>
<div class="seg-row"><span id="musTryOut">${song ? `Rule ${i + 1} picks <b>${escapeHtml(song)}</b>` : '<span class="warn">No rule fits: nothing plays.</span>'}</span>${song ? `<button class="btn primary" data-act="musPlay" data-song="${escapeHtml(song)}">▶ Play ${escapeHtml(song)}</button><button class="btn subtle" data-act="musRuleShow" data-i="${i}">Show the rule</button>` : ''}</div>`;
  return card('Try a place', body, { sub: 'Set where you are; the table answers with the song the game would play.' });
}
function musicWhereSet(i, k, raw) {
  const w = musicData().where[i];
  if (!w) return;
  if (k === '+') {
    if (!raw) return;
    const O = musicWhereOptions(),
      first = {
        started: true,
        indoor: true,
        map: [((studioState.D.locations || [])[0] || {}).id || 'copperleaf'],
        row: [0, 2],
      };
    w[raw] = raw in first ? first[raw] : O[raw][0];
  } else if (k === 'started' || k === 'indoor') raw === '' ? delete w[k] : (w[k] = raw === 'true');
  else if (k === 'map') {
    const L = raw
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
    L.length ? (w.map = L) : delete w.map;
  } else if (k === 'row0' || k === 'row1') {
    const r = w.row ? [...w.row] : [0, 99],
      n = raw === '' ? null : Math.max(0, Math.round(+raw));
    if (n == null) delete w.row;
    else {
      r[k === 'row0' ? 0 : 1] = n;
      w.row = [Math.min(r[0], r[1]), Math.max(r[0], r[1])];
    }
  } else if (k === 'song') {
    if (raw) w.song = raw;
  } else raw === '' ? delete w[k] : (w[k] = raw);
  /* keys in the schema's order, the song last, as the file has them */
  const order = [...MUSIC_WHERE_KEYS, 'song'],
    tidy = Object.fromEntries(order.filter(x => w[x] !== undefined).map(x => [x, w[x]]));
  musicData().where[i] = tidy;
  changed();
  commit(true);
  render();
}
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el || !el.dataset) return;
  if (el.dataset.mw !== undefined) musicWhereSet(+el.dataset.mw, el.dataset.mk, el.value);
  else if (el.dataset.mt !== undefined) {
    const k = el.dataset.mt,
      t = musicStudio.tryState;
    if (k === 'started' || k === 'indoor') t[k] = el.value === 'true';
    else if (k === 'row') t.row = el.value === '' ? null : +el.value;
    else t[k] = el.value || null;
    render();
  }
});
ACTIONS.musCondDel = d => {
  delete musicData().where[+d.i][d.k];
  musicStudio.picked = +d.i;
  changed();
  commit(true);
  render();
};
ACTIONS.musRulePlay = d => musicPlay(musicData().where[+d.i].song);
ACTIONS.musRuleMove = d => {
  const W = musicData().where,
    i = +d.i,
    j = i + +d.d;
  if (j < 0 || j >= W.length) return;
  [W[i], W[j]] = [W[j], W[i]];
  musicStudio.picked = j;
  changed();
  commit(true);
  render();
  const b = document.querySelector(`#musRule${j} [data-act="musRuleMove"][data-d="${d.d}"]:not([disabled])`);
  if (b) /** @type {HTMLElement} */ (b).focus();
};
ACTIONS.musRuleDel = d => {
  const W = musicData().where;
  if (W.length < 2) return;
  W.splice(+d.i, 1);
  musicStudio.picked = -1;
  changed();
  commit(true);
  render();
};
ACTIONS.musRuleAdd = () => {
  const W = musicData().where,
    at = Math.max(0, W.length - 1);
  W.splice(at, 0, { biome: Object.keys(studioState.D.biomes || {})[0] || 'meadow', song: musicSelected() });
  musicStudio.picked = at;
  changed();
  commit(true);
  render();
};
ACTIONS.musRuleShow = d => {
  musicStudio.picked = +d.i;
  render();
  const r = document.getElementById('musRule' + d.i);
  if (r) r.scrollIntoView({ block: 'center' });
};
/* ---------- SND-11: the Instruments tab ----------
   Each instrument (music.json instruments, baked by logic/sound-bake.js through the tracker's bank) previewed: a run
   up and down its notes (a drum: a beat), and each ensemble: the songs that name it played as it (GB Sounds off for
   them), its parts' instrument, level, pan and reverb send edited (heard from the next bar). Through the game's chain */
function musicInstrumentsHTML() {
  const I = musicData().instruments || {};
  const rows = Object.keys(I)
    .map(
      k =>
        `<div class="mus-row"><button class="btn subtle mus-play" data-act="musInst" data-k="${escapeHtml(k)}" aria-label="Play ${escapeHtml(k)}" title="Play ${escapeHtml(k)}">▶</button><span class="lt"><b>${escapeHtml(k)}</b> <small class="help">${escapeHtml(I[k].kind)} · ${escapeHtml(musicNoteName(I[k].lo))}-${escapeHtml(musicNoteName(I[k].hi))} · ${escapeHtml(I[k].name || '')}</small></span></div>`
    )
    .join('');
  return card('Instruments', rows || '<p class="help">No instruments in music.json.</p>', {
    sub: 'Synthesised once into memory (no sound files), then played like a DS sound bank. ▶ plays a run over its notes; a drum plays a beat. Their recipes are in music.json instruments (their ids stay: ensembles and battle sounds name them).',
  });
}
function musicEnsemblesHTML() {
  const E = musicData().ensembles || {},
    songs = musicData().songs,
    insts = Object.keys(musicData().instruments || {}).map(k => [k, k]);
  const body = Object.keys(E)
    .map(id => {
      const using = Object.keys(songs).filter(
        s => songs[s].ensemble === id || (songs[s].night && songs[s].night.ensemble === id)
      );
      const plays = using.length
        ? using
            .map(
              s =>
                `<button class="btn" data-act="musEnsPlay" data-song="${escapeHtml(s)}" data-night="${songs[s].ensemble === id ? '' : '1'}">▶ ${escapeHtml(s)}${songs[s].ensemble === id ? '' : ' at night'}</button>`
            )
            .join('')
        : '<small class="help">No song names it.</small>';
      const parts = E[id].parts
        .map((P, i) => {
          const p = `music.ensembles.${id}.parts.${i}`;
          return `<div class="mus-part"><b>${i + 1}. ${escapeHtml(P.line)}</b> ${P.wave ? `<small class="help">chip ${escapeHtml(P.wave)}</small>` : P.kit ? `<small class="help">kit ${escapeHtml(Object.values(P.kit).join(', '))}</small>` : selectField('Instrument', `${p}.inst`, insts)}${grid(
            numberField('Level', `${p}.level`, { opt: 1, min: 0, max: 4, step: 0.05, ph: '1' }),
            numberField('Pan', `${p}.pan`, { opt: 1, min: -1, max: 1, step: 0.05, ph: '0' }),
            numberField('Reverb', `${p}.verb`, { opt: 1, min: 0, max: 1, step: 0.05, ph: '0' })
          )}</div>`;
        })
        .join('');
      return `<details class="mus-ens" id="musEns_${escapeHtml(id)}"><summary><b>${escapeHtml(id)}</b> <small class="help">${escapeHtml(E[id].name || '')}</small></summary><div class="seg-row">${plays}</div>${numberField('Trim', `music.ensembles.${id}.trim`, { opt: 1, min: -24, max: 24, step: 0.1, unit: 'dB', help: 'On top of the song’s own trim, so it sits where the song’s gb version does (tools/check-sound.py --loudness)' })}${parts}</details>`;
    })
    .join('');
  return card('Ensembles', body || '<p class="help">No ensembles in music.json.</p>', {
    sub: 'Chip+ meets DS-era: the parts that play a song in place of the four chip voices. A song picks one in its recipe; GB Sounds plays gb. Judge the balance on the phone (the Sound test), not here.',
  });
}
/** SND-11: an instrument's preview: a run up and down its notes from near middle C, or a drum's beat */
function musicInstrumentPlay(id) {
  const T = musicTracker(),
    R = (musicData().instruments || {})[id];
  if (!R) return;
  if (musicStudio.ctx.state !== 'running') musicStudio.ctx.resume().catch(() => {});
  const out = musicStudio.chain.music;
  T.bankReady(id).then(() => {
    const t0 = musicStudio.ctx.currentTime + 0.05;
    if (R.lo === R.hi) {
      for (let k = 0; k < 16; k++)
        T.sampleVoice(out, { inst: id, midi: R.lo, t: t0 + k * 0.2, dur: 0.1, vol: k % 4 ? 0.3 : 0.6 });
      return;
    }
    const base = Math.max(R.lo, Math.min(60, R.hi - 24)),
      run = [0, 4, 7, 12, 16, 19, 24, 19, 16, 12, 7, 4, 0].map(x => base + x).filter(m => m <= R.hi);
    run.forEach((m, k) => T.sampleVoice(out, { inst: id, midi: m, t: t0 + k * 0.22, dur: 0.2, vol: 0.4 }));
  });
}
ACTIONS.musInst = d => musicInstrumentPlay(d.k);
ACTIONS.musEnsPlay = d => {
  musicStudio.gb = false;
  musicStudio.night = !!d.night;
  const T = musicTracker(),
    name = d.night ? d.song + '@night' : d.song;
  /* its notes baked first, so it plays as the ensemble from its first bar */
  T.prepare(name).then(() => musicPlay(d.song));
};
ACTIONS.musTab = d => {
  studioState.sel.musicTab = d.t;
  render();
};
SECTIONS.music = () => {
  if (!studioState.D.music) return card('Music', '<p class="help">This game data has no music.json.</p>');
  if (!legacyView.data && !legacyView.loading && !legacyView.error)
    legacyLoad().then(() => {
      if (sectionShown('music')) render();
    });
  if (musicStudio.tracker) musicStudio.tracker.refresh(musicData().songs);
  musicMixApply();
  /* the Check's Show me: a where rule to mark and scroll to */
  if (studioState.sel.musicRule != null) {
    const r = +studioState.sel.musicRule;
    delete studioState.sel.musicRule;
    musicStudio.picked = r;
    afterRender(() => {
      const el = document.getElementById('musRule' + r);
      if (el) el.scrollIntoView({ block: 'center' });
    });
  }
  const id = musicSelected(),
    uses = musicUses(),
    u = uses[id] || [];
  const plays = u.length
    ? `<ul class="mus-uses">${u.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`
    : '<p class="warn">Nothing plays this song: no where-rule, place, story script or code names it.</p>';
  musicStudio.shown = '';
  afterRender(musicNowShow);
  afterRender(() => musicHookMount(id));
  const tab = ['where', 'jingles', 'sounds', 'instruments'].includes(studioState.sel.musicTab)
      ? studioState.sel.musicTab
      : 'songs',
    tabs = `<div class="seg-row tabs" role="tablist">${[
      ['songs', 'Songs'],
      ['where', 'Where they play'],
      ['jingles', 'Jingles'],
      ['sounds', 'Sounds'],
      ['instruments', 'Instruments'],
    ]
      .map(
        ([k, n]) =>
          `<button class="seg ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" data-act="musTab" data-t="${k}">${n}</button>`
      )
      .join('')}</div>`;
  if (tab === 'jingles') {
    afterRender(musicJingleMount);
    return `<div class="split"><aside class="list-col">${musicListColHTML(uses)}</aside><div class="ed-col">${tabs}${musicJingleHTML()}</div></div>`;
  }
  /* SND-6: the base cries, the buttons' sounds, the mix */
  if (tab === 'sounds') {
    if (studioState.sel.musicCry) {
      const k = studioState.sel.musicCry;
      delete studioState.sel.musicCry;
      afterRender(() => {
        const el = /** @type {HTMLDetailsElement | null} */ (document.getElementById('musCry_' + k));
        if (el) {
          el.open = true;
          el.scrollIntoView({ block: 'center' });
        }
      });
    }
    return `<div class="split"><aside class="list-col">${musicListColHTML(uses)}</aside><div class="ed-col">${tabs}${musicBaseCriesHTML()}${musicUiSoundsHTML()}${musicScapeHTML()}${musicMixHTML()}</div></div>`;
  }
  if (tab === 'where')
    return `<div class="split"><aside class="list-col">${musicListColHTML(uses)}</aside><div class="ed-col">${tabs}${musicWhereHTML()}</div></div>`;
  /* SND-11: the instruments and the ensembles */
  if (tab === 'instruments')
    return `<div class="split"><aside class="list-col">${musicListColHTML(uses)}</aside><div class="ed-col">${tabs}${musicEnsemblesHTML()}${musicInstrumentsHTML()}</div></div>`;
  return `<div class="split"><aside class="list-col">${musicListColHTML(uses)}</aside>
 <div class="ed-col">${tabs}<div class="ed-head"><div><small class="mono">music.json · songs.${escapeHtml(id)}</small><h2>${escapeHtml(id)}</h2></div><div class="seg-row"><button class="btn primary" data-act="musPlay" data-song="${escapeHtml(id)}">▶ Play</button><button class="btn" data-act="musStop">■ Stop</button></div></div>
 ${musicRecipeHTML(id)}${musicHookHTML(id)}${card('Where it plays', plays, { sub: 'From the where table (first rule that fits wins), the places’ own songs, the story scripts and the game’s code.' })}</div></div>`;
};
const musicLoopHTML = () =>
  `<label class="mus-loop" title="Off: a song stops after its last bar"><input type="checkbox" id="musLoop" ${musicStudio.loop ? 'checked' : ''}>Loop</label><label class="mus-loop" title="On: the night version, as outdoors at night (slower and lower unless the song writes its own)"><input type="checkbox" id="musNight" ${musicStudio.night ? 'checked' : ''}>Night</label><label class="mus-loop" title="On: every song on the four chip voices, as the game's Settings → Sound → GB Sounds (from the next bar)"><input type="checkbox" id="musGb" ${musicStudio.gb ? 'checked' : ''}>GB Sounds</label>${musicPartHTML()}`;
/* SND-5: which version ▶ plays: as written, a battle song's tense version, or a run song's arc
   band (Night goes over a band) */
const musicPartHTML = () =>
  `<label class="mus-loop" title="Which version ▶ plays (a song without it plays as written)">Version <select id="musPart">${[
    ['', 'as written'],
    ['tense', 'tense (red zone)'],
    ...((musicData().run && musicData().run.arc) || []).map(B => [B.name, `rows ${B.row[0]}-${B.row[1]} (${B.name})`]),
  ]
    .map(
      ([k, n]) =>
        `<option value="${escapeHtml(k)}" ${k === musicStudio.part ? 'selected' : ''}>${escapeHtml(n)}</option>`
    )
    .join('')}</select></label>`;
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (el && el.id === 'musLoop') musicStudio.loop = el.checked;
  /* SND-11: the song playing switches on its next bar line */
  if (el && el.id === 'musGb') musicStudio.gb = el.checked;
  if (el && (el.id === 'musNight' || el.id === 'musPart')) {
    if (el.id === 'musNight') musicStudio.night = el.checked;
    else musicStudio.part = el.value;
    /* the song playing switches to its other version from the start */
    const now = musicPlaying();
    if (now) musicPlay(now.split('@')[0]);
  }
});
ACTIONS.musPlay = d => musicPlay(d.song);
ACTIONS.musStop = () => musicStop();
ACTIONS.musPick = d => {
  studioState.sel.musicSong = d.song;
  render();
};
