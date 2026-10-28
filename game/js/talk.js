'use strict';
/* ================= CONVERSATIONS =================
   One dialogue box for everyone who talks: Professor Chosen and Kappi, your rival Blake, townsfolk, trainers and the opening cutscene.
   A portrait that blinks and moves its mouth while the line types out, the speaker's name, a voice blip per few
   letters (sound.js), tap or Enter to finish the line or go on. Lines may start with an expression in brackets:
   "[happy] Nice to meet you!" (happy, surprised, sad, angry, blink, talk). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { mapChatLines, playStoryScript, provide, residentHomeTalk, storyFreshTake, storyGiftOffer } from './hooks.js';
import { PEOPLE, TRAINERS } from './game-data.js';
import { parseLine, plainOf } from './logic/line-markup.js';
import { letterTimes } from './logic/talk-type.js';
import { reducedMotion, saveData } from './game-state.js';
import { frameStop, frameTask } from './frame-scheduler.js';
import { drawPortrait, lookOf } from './person-art.js';
import { turnToPlayer, walkView } from './walk-view.js';
import { walkRenderer } from './walk/walk-state.js';
import { soundEffect } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  FOLK_NAMES: [() => FOLK_NAMES],
  FOLK_TALK: [() => FOLK_TALK],
  SPEAKER_NAMES: [() => SPEAKER_NAMES],
  TALK_FX: [() => TALK_FX],
  TALK_PORTRAIT_SCALE: [() => TALK_PORTRAIT_SCALE],
  drawTalkPortrait: [() => drawTalkPortrait, v => (drawTalkPortrait = v)],
  talk: [() => talk, v => (talk = v)],
  talkBox: [() => talkBox],
  talkChoose: [() => talkChoose, v => (talkChoose = v)],
  talkChosen: [() => talkChosen, v => (talkChosen = v)],
  talkEl: [() => talkEl, v => (talkEl = v)],
  talkFolk: [() => talkFolk, v => ((talkFolk = v), provide({ talkFolk }))],
  talkHide: [() => talkHide, v => (talkHide = v)],
  talkLetters: [() => talkLetters, v => (talkLetters = v)],
  talkLine: [() => talkLine, v => (talkLine = v)],
  talkName: [() => talkName, v => (talkName = v)],
  talkTick: [() => talkTick, v => (talkTick = v)],
});
/* eslint-enable no-func-assign */
provide({ talkFolk });
/* to-module: end */
/* onType (phase 06-3): functions called for each character typed, ({ who, ch, n, done }); phase 07's mouths use it */
export const talkBox = {
  on: false,
  cur: null,
  por: { who: null, expr: null, t: 0 },
  el: null,
  onType: /** @type {((e: { who: string, ch: string, n: number, done: boolean }) => void)[]} */ ([]),
  /* Project Story: the choice on screen (talkChoose), if any */
  choice: /** @type {{ pick: (i: number) => void, n: number } | null} */ (null),
};
provide({ talkBox }); /* to-module */
const SPEAKER_NAMES = { chosen: 'Professor Chosen' };
const FOLK_NAMES = [
  'Ada',
  'Bram',
  'Cleo',
  'Dex',
  'Edie',
  'Finn',
  'Gus',
  'Hana',
  'Ivo',
  'Juno',
  'Kit',
  'Lena',
  'Milo',
  'Nell',
  'Otto',
  'Pia',
  'Quin',
  'Rosa',
  'Sami',
  'Tess',
  'Ugo',
  'Vera',
  'Wim',
  'Yara',
  'Zeb',
];
function talkName(who) {
  if (who === 'me') return lookOf('me').name || 'You';
  if (typeof who === 'string' && who.startsWith('folk:')) return FOLK_NAMES[+who.slice(5) % FOLK_NAMES.length];
  return (
    SPEAKER_NAMES[who] ||
    (typeof PEOPLE !== 'undefined' &&
      PEOPLE[who] &&
      ((PEOPLE[who].look && PEOPLE[who].look.name) || PEOPLE[who].name)) ||
    ((typeof TRAINERS !== 'undefined' && Object.values(TRAINERS).find(t => t.who === who)) || {}).name ||
    'Someone'
  );
}
function talkEl() {
  let el = talkBox.el;
  if (el && el.isConnected) return el;
  el = document.createElement('div');
  el.id = 'talk';
  el.className = 'talk-layer';
  el.hidden = true;
  el.innerHTML =
    /* phase 06-3: the portrait framed in its own 96×96 slot inside the box, a name tag over the line (css/dialogue.css) */
    '<div class="talk-box px" role="dialog" aria-live="polite"><span class="talk-slot"><canvas class="talk-por" aria-hidden="true"></canvas></span><div class="talk-txt"><p class="talk-who"></p><p class="talk-line"></p></div><span class="talk-more" aria-hidden="true">▼</span></div>';
  el.addEventListener('click', ev => {
    if (ev.target.closest('button,a,input')) return;
    if (talkBox.cur) talkBox.cur.tap();
  });
  document.body.appendChild(el);
  talkBox.el = el;
  return el;
}
/** the effects a run's letters carry, as classes (game/css/talk-text.css); [slow] and [fast] only change the timing */
const TALK_FX = ['b', 'i', 'big', 'small', 'wave', 'shake'];
/* DL-2: the line's letters as spans (createElement and textContent only, never innerHTML: a name is text). A
   visually hidden copy of the plain line is what a screen reader hears; the letters are hidden from it. Each word is
   a span that doesn't break, so the line wraps between words as before and the box has its final size before the
   first letter shows. Returns the letter spans by the parse's letter index (null for a space or a line break). */
function talkLetters(line, parsed) {
  line.textContent = '';
  line.dataset.onePiece = '';
  const sr = document.createElement('span');
  sr.className = 'talk-sr';
  sr.textContent = parsed.plain;
  const glyphs = document.createElement('span');
  glyphs.className = 'talk-glyphs';
  glyphs.setAttribute('aria-hidden', 'true');
  line.append(sr, glyphs);
  const chars = [...parsed.plain],
    fx = new Array(chars.length).fill('');
  for (const r of parsed.runs) {
    const cls = [];
    for (const [k, v] of Object.entries(r.fx))
      if (TALK_FX.includes(k)) cls.push(`fx-${k}`);
      else if (k === 'c') cls.push(`fx-c-${v}`);
    for (let i = r.from; i < r.to; i++) fx[i] = cls.join(' ');
  }
  /** @type {(HTMLElement | null)[]} */
  const out = [];
  let word = null,
    k = 0;
  chars.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      word = null;
      glyphs.append(ch);
      out.push(null);
      return;
    }
    if (!word) {
      word = document.createElement('span');
      word.className = 'w';
      glyphs.append(word);
    }
    const l = document.createElement('span');
    l.className = fx[i] ? `l ${fx[i]}` : 'l';
    /* --i counts the letters of each effect run's wave and the order they arrive in */
    l.style.setProperty('--i', String(k++));
    l.textContent = ch;
    word.append(l);
    out.push(l);
  });
  return out;
}
/* one line; the box stays open for the next one until talkHide() */
export function talkLine(who, text, expr, o = {}) {
  const el = talkEl();
  /* DL-1: the line's markup read once (logic/line-markup.js); talkBox.cur.text stays the plain line. DL-2: its letters
     drawn as spans with their effects (talkLetters), shown on the times logic/talk-type.js gives */
  const parsed = parseLine(text || '');
  expr = expr || parsed.expr;
  text = parsed.plain;
  const shown = !el.hidden;
  el.hidden = false;
  el.classList.toggle('in-cs', !!o.cs);
  el.classList.toggle('scrim', !!o.scrim);
  document.body.classList.add('talking');
  const box = el.querySelector('.talk-box'),
    line = el.querySelector('.talk-line');
  el.querySelector('.talk-who').textContent = o.name || talkName(who);
  box.classList.remove('done');
  const letters = talkLetters(line, parsed),
    chars = [...text],
    speed = reducedMotion
      ? 'instant'
      : (typeof saveData !== 'undefined' && saveData?.preferences?.textSpeed) || 'normal',
    times = letterTimes(parsed, speed).at,
    style = parsed.style.find(s => s === 'shout' || s === 'whisper' || s === 'think') || '';
  /* UI-2: each new line in an open box, the bubble pops a little: a squash, then a spring back (the `scale`
     property, so the box's own transform stays) */
  if (shown && !reducedMotion && box.animate)
    box.animate([{ scale: '0.975 0.95' }, { scale: '1 1' }], {
      duration: 360,
      easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
    });
  talkBox.on = true;
  talkBox.por = { who, expr: expr || null, t: 0 };
  if (!talkBox.loop) {
    talkBox.loop = true;
    frameTask('talk', talkTick, () => 30);
  }
  return new Promise(res => {
    const st = { who, text, parsed, n: 0, t0: performance.now(), typing: true, res };
    talkBox.cur = st;
    let blipN = 0;
    const step = () => {
      if (talkBox.cur !== st) return;
      const n0 = st.n,
        now = performance.now() - st.t0;
      let n = n0;
      while (n < chars.length && times[n] <= now) n++;
      st.n = n;
      for (let i = n0; i < n; i++) letters[i]?.classList.add('on');
      /* phase 06-3: the typing hook (phase 07's mouth animation listens here): each new character, who says it */
      if (talkBox.onType.length)
        for (let i = n0; i < n; i++)
          for (const f of talkBox.onType) f({ who, ch: chars[i], n: i + 1, done: i + 1 >= chars.length });
      /* the voice every 3 letters, in the line's style (a thought is silent) */
      const b = Math.floor(n / 3);
      if (b > blipN && n < chars.length) {
        blipN = b;
        if (typeof soundEffect === 'function' && style !== 'think' && /\w/.test(chars[n] || ''))
          soundEffect('blip', { who, style, big: !!letters[n]?.classList.contains('fx-big') });
      }
      if (n >= chars.length) {
        st.typing = false;
        box.classList.add('done');
        return;
      }
      requestAnimationFrame(step);
    };
    step();
    st.tap = () => {
      if (st.typing) {
        st.t0 = -1e9;
        return;
      }
      if (typeof soundEffect === 'function') soundEffect('tick');
      st.done();
    };
    st.done = () => {
      if (talkBox.cur !== st) return;
      talkBox.cur = null;
      res();
    };
  });
}
export function talkHide() {
  const el = talkBox.el;
  if (el) el.hidden = true;
  talkBox.cur = null;
  talkBox.on = false;
  document.body.classList.remove('talking');
}
/* Project Story: a choice after a line, its options as buttons over the box's top corner; tap one, or press 1-9. The
   line before it stays on screen. Resolves with the option's index. */
export function talkChoose(options) {
  const el = talkEl(),
    box = el.querySelector('.talk-box');
  el.hidden = false;
  talkBox.on = true;
  document.body.classList.add('talking');
  box.classList.add('done');
  box.querySelector('.talk-choices')?.remove();
  const list = document.createElement('div');
  list.className = 'talk-choices';
  list.setAttribute('role', 'group');
  return new Promise(res => {
    const pick = i => {
      if (talkBox.choice !== C) return;
      talkBox.choice = null;
      list.remove();
      if (typeof soundEffect === 'function') soundEffect('tick');
      res(i);
    };
    const C = { pick, n: options.length };
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'talk-choice';
      b.textContent = plainOf(o.text);
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        pick(i);
      });
      list.appendChild(b);
    });
    box.appendChild(list);
    talkBox.choice = C;
    list.querySelector('button').focus({ preventScroll: true });
  });
}
/* a whole conversation: [[who,text,expr],…] or [{who,text,expr}] */
export async function talk(lines, o = {}) {
  for (const l of lines) {
    const [who, text, expr] = Array.isArray(l) ? l : [l.who, l.text, l.expr];
    await talkLine(who, text, expr, o);
  }
  talkHide();
}
/* phase 06-4: portraits are 64 art pixels (owner, 2026-10-19), shown 1.5× (96 CSS px) in the dialogue box. To stay crisp
   the picture is scaled by a whole number of device pixels per art pixel, near 1.5× and never much over it, so a 64 px
   portrait stays inside the 96 px slot (exactly
   1.5× on a 2× phone), and the canvas is sized to match */
const TALK_PORTRAIT_SCALE = 1.5;
function drawTalkPortrait(cv, who, ex, ts) {
  if (!cv) return;
  const src = talkBox.src || (talkBox.src = document.createElement('canvas'));
  drawPortrait(src, who, ex, ts);
  if (!src.width || !src.height) return;
  const dpr = devicePixelRatio || 1,
    k = Math.max(1, Math.floor(TALK_PORTRAIT_SCALE * dpr + 0.25)),
    w = src.width * k,
    h = src.height * k;
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
    cv.style.width = w / dpr + 'px';
    cv.style.height = h / dpr + 'px';
  }
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, w, h);
  x.drawImage(src, 0, 0, w, h);
}
function talkTick(ts) {
  const P = talkBox.por,
    el = talkBox.el;
  if (!talkBox.on || !el || el.hidden || !P.who) {
    talkBox.loop = false;
    frameStop('talk');
    return;
  }
  if (ts - P.t < 70) return;
  P.t = ts;
  const typing = talkBox.cur && talkBox.cur.typing,
    blink = ts % 3700 < 130 && P.expr !== 'happy';
  const ex = blink ? 'blink' : typing && !P.expr && Math.floor(ts / 120) % 2 ? 'talk' : P.expr;
  try {
    drawTalkPortrait(el.querySelector('.talk-por'), P.who, ex, ts);
  } catch (e) {}
}
document.addEventListener('keydown', ev => {
  if (talkBox.choice && /^[1-9]$/.test(ev.key) && +ev.key <= talkBox.choice.n) {
    ev.preventDefault();
    talkBox.choice.pick(+ev.key - 1);
    return;
  }
  if (!talkBox.cur || talkBox.el.hidden) return;
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    talkBox.cur.tap();
  }
});

/* ---------- people in the walk scenes ---------- */
const FOLK_TALK = [
  '[happy] Oh, hi! Out for a walk too?',
  'My feet are tired, but I’ve seen three towns today.',
  '[surprised] Is that a trainer card? Fancy!',
  'I used to have a Billie. It bought my house and moved me out.',
  'A pyramid saved is a Billie caught, they say. I never know who says it.',
  '[happy] Lovely day under the Inner Sun.',
  'Careful in the tall grass. They hide in there.',
];
async function talkFolk(f) {
  if (talkBox.on) return;
  /* RS-3: a resident of Copperleaf says their own line (story.js residentHomeTalk) */
  if (f.res && typeof residentHomeTalk === 'function') {
    await residentHomeTalk(f);
    return;
  }
  const sc = walkView.sc,
    L = typeof mapChatLines === 'function' ? mapChatLines(FOLK_TALK) : sc.chat && sc.chat.length ? sc.chat : FOLK_TALK,
    who = 'folk:' + f.seed,
    a = L[(f.line + (walkView.chat = (walkView.chat || 0) + 1)) % L.length],
    b = FOLK_TALK[(f.seed + walkView.chat) % FOLK_TALK.length];
  f.wait = 99;
  f.route = null;
  f.walk = 0;
  turnToPlayer(f);
  if (typeof walkRenderer !== 'undefined') {
    walkRenderer.focusT = { x: f.x, z: f.z, t: walkView.t };
    /* CAM-2: who you talk to, for the camera's two-shot (walk/camera.js) */
    walkRenderer.talkAt = { x: f.x, z: f.z, t: walkView.t };
  }
  await talk([
    [who, a],
    [who, b === a ? FOLK_TALK[0] : b],
  ]);
  f.wait = 2;
}
/* Professor Chosen in his lab: his script (story.json scripts.chosen): your Index, your badges, where Blake went */
export async function talkChosen() {
  if (talkBox.on) return;
  /* RL-S2: a Bean for him first, when you have one */
  if (await storyGiftOffer('chosen')) return;
  /* RL-S1: the first talk after a run: his line picked on the way home, once, in place of his own */
  const fresh = storyFreshTake('chosen');
  await playStoryScript(fresh ? 'banter:' + fresh : 'story:chosen');
}
