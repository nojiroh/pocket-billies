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
import { midiToFrequency, trackerCompose, trackerCreate } from '../../game/js/audio/tracker.js';
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
  MUSIC_JINGLE_BPM: [() => MUSIC_JINGLE_BPM],
  MUSIC_TABS: [() => MUSIC_TABS],
  ROLL_CELL_H: [() => ROLL_CELL_H],
  ROLL_CELL_W: [() => ROLL_CELL_W],
  ROLL_LEFT: [() => ROLL_LEFT],
  ROLL_TOP: [() => ROLL_TOP],
  musicCheckFindings: [() => musicCheckFindings, v => ((musicCheckFindings = v), provide({ musicCheckFindings }))],
  musicCryCardHTML: [() => musicCryCardHTML, v => ((musicCryCardHTML = v), provide({ musicCryCardHTML }))],
  musicCryPlay: [() => musicCryPlay, v => (musicCryPlay = v)],
  musicCryTidy: [() => musicCryTidy, v => ((musicCryTidy = v), provide({ musicCryTidy }))],
  musicData: [() => musicData],
  musicHookHTML: [() => musicHookHTML, v => (musicHookHTML = v)],
  musicHookMount: [() => musicHookMount, v => (musicHookMount = v)],
  musicJingleHTML: [() => musicJingleHTML, v => (musicJingleHTML = v)],
  musicJingleMount: [() => musicJingleMount, v => (musicJingleMount = v)],
  musicJinglePlay: [() => musicJinglePlay, v => (musicJinglePlay = v)],
  musicJingleSelected: [() => musicJingleSelected],
  musicLineSet: [() => musicLineSet, v => (musicLineSet = v)],
  musicListColHTML: [() => musicListColHTML],
  musicLoopHTML: [() => musicLoopHTML],
  musicNoteHear: [() => musicNoteHear, v => (musicNoteHear = v)],
  musicNowShow: [() => musicNowShow, v => (musicNowShow = v)],
  musicPickHTML: [() => musicPickHTML],
  musicPlay: [() => musicPlay, v => (musicPlay = v)],
  musicPlaying: [() => musicPlaying],
  musicRecipeHTML: [() => musicRecipeHTML, v => (musicRecipeHTML = v)],
  musicRollMount: [() => musicRollMount, v => (musicRollMount = v)],
  musicRollRows: [() => musicRollRows, v => (musicRollRows = v)],
  musicSelected: [() => musicSelected],
  musicSongIds: [() => musicSongIds],
  musicSongListHTML: [() => musicSongListHTML, v => (musicSongListHTML = v)],
  musicStop: [() => musicStop, v => (musicStop = v)],
  musicStudio: [() => musicStudio],
  musicSummary: [() => musicSummary],
  musicTracker: [() => musicTracker, v => (musicTracker = v)],
  musicTryHTML: [() => musicTryHTML, v => (musicTryHTML = v)],
  musicUses: [() => musicUses, v => (musicUses = v)],
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
  shown: '',
  /** the where rule last moved, added or shown (marked in the table) */ picked: -1,
  /** the line the hook roll edits: hook or counter */ line: 'hook',
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
export function musicPlay(name) {
  const T = musicTracker();
  if (musicStudio.ctx.state !== 'running') musicStudio.ctx.resume().catch(() => {});
  T.refresh(musicData().songs);
  if (T.song) T.stop();
  /* SND-4: with Night on, the night version, if the song has one */
  const S = musicData().songs[name];
  T.play(musicStudio.night && S && S.night !== false ? name + '@night' : name);
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
      ? `▶ ${sg.name} · bar ${Math.floor((sg.step % sg.D.steps) / 16) + 1} of ${sg.D.steps / 16}`
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
      selectField('Drums', `${p}.drums`, MUSIC_CHOICES.drums)
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
  const sc = MUSIC_SCALES[scale] || MUSIC_SCALES.major,
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
    line = musicStudio.line === 'counter' ? 'counter' : 'hook',
    has = k => (S[k] || []).length;
  const tabs = [
    ['hook', `Hook${has('hook') ? ` (${has('hook')})` : ''}`],
    ['counter', `Countermelody${has('counter') ? ` (${has('counter')})` : ''}`],
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
      help: 'One name for the hook and its countermelody. Claude’s drafts start with “placeholder”; the Check lists them until you rename them.',
    }) +
      `<div class="seg-row">${tabs}<span class="grow"></span><button class="btn subtle" data-act="musHookFromTune" ${line === 'hook' ? '' : 'hidden'} title="Start from the composed tune’s first two bars">Copy the tune’s bars 1-2</button><button class="btn subtle" data-act="musLineClear" ${has(line) ? '' : 'disabled'}>Clear</button></div>
<div class="mus-roll-wrap"><canvas id="musRoll" class="mus-roll" aria-label="${line === 'hook' ? 'Hook' : 'Countermelody'} roll, 32 sixteenths: ${(S[line] || []).map(n => musicNoteName(n[1]) + ' at ' + (n[0] + 1)).join(', ') || 'empty'}"></canvas></div>`,
    {
      sub:
        line === 'hook'
          ? 'Two bars the game plays instead of its own tune in bars 1-2 and again in 5-6. The faint notes are the composed tune; an empty hook keeps it.'
          : 'A second, quieter line under bars 1-2 and 5-6. The faint notes are the lead it plays against.',
    }
  );
}
function musicHookMount(id) {
  const cv = /** @type {HTMLCanvasElement | null} */ (document.getElementById('musRoll'));
  if (!cv) return;
  const S = musicData().songs[id],
    line = musicStudio.line === 'counter' ? 'counter' : 'hook',
    C = trackerCompose(S),
    base = S.key >= 64 ? S.key - 12 : S.key;
  const lead = [];
  for (let st = 0; st < 32; st++) if (C.notes[st]) lead.push([st, C.notes[st][0], C.notes[st][1]]);
  musicRollMount(cv, {
    steps: 32,
    /* the composed tune walks from the octave above the key up to about an octave and a half over it */
    rows: musicRollRows(S.key, S.scale, base + 5, 26),
    home: S.key,
    notes: S[line] || [],
    ghost: line === 'hook' && !(S.hook || []).length ? lead : line === 'counter' ? lead : [],
    labels: [0, 1].map(b => `bar ${b + 1}: ${chordNumeral(S.scale, S.prog[b])}`),
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
ACTIONS.musLineClear = () => musicLineSet(musicSelected(), musicStudio.line === 'counter' ? 'counter' : 'hook', []);
ACTIONS.musHookFromTune = () => {
  const id = musicSelected(),
    C = trackerCompose(musicData().songs[id]),
    out = [];
  for (let st = 0; st < 32; st++) if (C.notes[st]) out.push([st, C.notes[st][0], C.notes[st][1]]);
  musicLineSet(id, 'hook', out);
};

/* ---------- the jingles: short tunes that play once (a win, a level up, a catch...) ----------
   A jingle is a list of [midi, sixteenths] one after another, 0 a rest; on the roll it is notes on a timeline. The
   game plays them at 150 bpm on a 25 % pulse with a triangle an octave down (the level up at 180 in battle) */
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
<div class="mus-roll-wrap"><canvas id="musJRoll" class="mus-roll" aria-label="${escapeHtml(cur)} roll: ${J[cur].notes.map(n => (n[0] ? musicNoteName(n[0]) : 'rest') + ' ' + n[1]).join(', ')}"></canvas></div>`,
    {
      sub: 'One note at a time, in sixteenths; a gap is a rest. The game plays them at 150 bpm on a 25 % pulse with a triangle an octave down (the battle’s level up at 180). They play on Sound effects.',
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
  T.jingle(J.notes, MUSIC_JINGLE_BPM, 'p25', T.bus);
}
ACTIONS.musJinglePlay = d => musicJinglePlay(d.j);
ACTIONS.musJinglePick = d => {
  studioState.sel.musicJingle = d.j;
  render();
};

/* ---------- a Billy's cry (the Billies page) ----------
   Gen 1 style: a base (music.json cries.bases), a pitch and a length per stage (lines/*.json cry); what a stage leaves
   out comes from its id, as before (logic/cries.js). Played on the music section's AudioContext */
function musicCryCardHTML(L, li, st) {
  const bases = ((studioState.D.music || {}).cries || {}).bases || [],
    sp = L.id + st,
    own = (L.cry || [])[st] || null,
    made = cryRecipe(sp, null, bases),
    p = `lines.${li}.cry.${st}`;
  const body =
    grid(
      selectField(
        'Base cry',
        `${p}.base`,
        bases.map((b, i) => [i, `${i + 1} · ${b.wave}`]),
        { num: 1, opt: 1, none: `From its id (${made.base + 1} · ${made.wave})` }
      ),
      numberField('Pitch', `${p}.pitch`, {
        opt: 1,
        min: 24,
        max: 96,
        step: 1,
        ph: `${made.pitch} (${musicNoteName(made.pitch)}, from its id)`,
        help: 'The first note, as a midi note (60 is middle C).',
      }),
      numberField('Length', `${p}.length`, { opt: 1, min: 0.25, max: 4, step: 0.05, ph: '1 (from its id)', unit: '×' })
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
    C0 = cryRecipe(L.id + st, (L.cry || [])[st], ((studioState.D.music || {}).cries || {}).bases || []),
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
  })) {
    if (f.lvl === 'warn' && !legacyView.data) continue;
    const sel = f.song
      ? { musicTab: 'songs', musicSong: f.song }
      : f.jingle
        ? { musicTab: 'jingles', musicJingle: f.jingle }
        : f.rule != null
          ? { musicTab: 'where', musicRule: f.rule }
          : {};
    out.push({ lvl: f.lvl, msg: `Music: ${f.msg}`, go: f.place ? 'world' : 'music', sel: f.place ? {} : sel });
  }
  const species = D.lines.flatMap(L => L.names.map((n, i) => (L.cry || [])[i])),
    own = species.filter(Boolean).length;
  if (own < species.length)
    out.push({
      lvl: 'info',
      msg: `Cries: ${species.length - own} of ${species.length} Billies use the cry their id makes. Set one in a Billy’s Cry card (sound track SND-6 gives each its own).`,
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
    })
  );
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
  const tab = ['where', 'jingles'].includes(studioState.sel.musicTab) ? studioState.sel.musicTab : 'songs',
    tabs = `<div class="seg-row tabs" role="tablist">${[
      ['songs', 'Songs'],
      ['where', 'Where they play'],
      ['jingles', 'Jingles'],
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
  if (tab === 'where')
    return `<div class="split"><aside class="list-col">${musicListColHTML(uses)}</aside><div class="ed-col">${tabs}${musicWhereHTML()}</div></div>`;
  return `<div class="split"><aside class="list-col">${musicListColHTML(uses)}</aside>
 <div class="ed-col">${tabs}<div class="ed-head"><div><small class="mono">music.json · songs.${escapeHtml(id)}</small><h2>${escapeHtml(id)}</h2></div><div class="seg-row"><button class="btn primary" data-act="musPlay" data-song="${escapeHtml(id)}">▶ Play</button><button class="btn" data-act="musStop">■ Stop</button></div></div>
 ${musicRecipeHTML(id)}${musicHookHTML(id)}${card('Where it plays', plays, { sub: 'From the where table (first rule that fits wins), the places’ own songs, the story scripts and the game’s code.' })}</div></div>`;
};
const musicLoopHTML = () =>
  `<label class="mus-loop" title="Off: a song stops after its last bar"><input type="checkbox" id="musLoop" ${musicStudio.loop ? 'checked' : ''}>Loop</label><label class="mus-loop" title="On: the night version, as outdoors at night (slower and lower unless the song writes its own)"><input type="checkbox" id="musNight" ${musicStudio.night ? 'checked' : ''}>Night</label>`;
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (el && el.id === 'musLoop') musicStudio.loop = el.checked;
  if (el && el.id === 'musNight') {
    musicStudio.night = el.checked;
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
