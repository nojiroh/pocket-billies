'use strict';
/* ================= CONVERSATIONS =================
   One dialogue box for everyone who talks: Professor Chosen and Kappi, your rival Blake, townsfolk, trainers and the opening cutscene.
   A portrait that blinks and moves its mouth while the line types out, the speaker's name, a voice blip per few
   letters (sound.js), tap or Enter to finish the line or go on. Lines may start with an expression in brackets:
   "[happy] Nice to meet you!" (happy, surprised, sad, angry, blink, talk). DL-5: the face is directed
   (logic/talk-director.js): blinks, the mouth on the vowels, a mid-line [face=x], emotes ([emote=x]) and the frame's
   bounce. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { mapChatLines, playStoryScript, provide, residentHomeTalk, storyFreshTake, storyGiftOffer } from './hooks.js';
import { EMOTES, FACTIONS, PEOPLE, TALK_SKINS, TRAINERS } from './game-data.js';
import { parseLine, plainOf } from './logic/line-markup.js';
import { letterTimes } from './logic/talk-type.js';
import { talkAccentHue, talkSeed, talkSkinOf, talkTilt, talkVariant } from './logic/talk-skins.js';
import { cutAt, knockOf, stackFit, stackStep, waitMs } from './logic/talk-stack.js';
import { EMOTE_MS, talkDirector } from './logic/talk-director.js';
import { reducedMotion, saveData } from './game-state.js';
import { frameStop, frameTask } from './frame-scheduler.js';
import { drawPortrait, lookOf } from './person-art.js';
import { turnToPlayer, walkView } from './walk-view.js';
import { walkRenderer } from './walk/walk-state.js';
import { soundEffect } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  BURST_VARIANTS: [() => BURST_VARIANTS],
  FOLK_NAMES: [() => FOLK_NAMES],
  FOLK_TALK: [() => FOLK_TALK],
  SPEAKER_NAMES: [() => SPEAKER_NAMES],
  TALK_FX: [() => TALK_FX],
  TALK_PORTRAIT_SCALE: [() => TALK_PORTRAIT_SCALE],
  drawTalkPortrait: [() => drawTalkPortrait, v => (drawTalkPortrait = v)],
  talk: [() => talk, v => (talk = v)],
  talkArrive: [() => talkArrive, v => (talkArrive = v)],
  talkBounce: [() => talkBounce, v => (talkBounce = v)],
  talkBox: [() => talkBox],
  talkChoose: [() => talkChoose, v => (talkChoose = v)],
  talkChosen: [() => talkChosen, v => (talkChosen = v)],
  talkCutLine: [() => talkCutLine, v => (talkCutLine = v)],
  talkDemote: [() => talkDemote, v => (talkDemote = v)],
  talkDress: [() => talkDress, v => (talkDress = v)],
  talkEl: [() => talkEl, v => (talkEl = v)],
  talkEmote: [() => talkEmote, v => (talkEmote = v)],
  talkEmoteArt: [() => talkEmoteArt],
  talkEmoteCanvas: [() => talkEmoteCanvas, v => (talkEmoteCanvas = v)],
  talkFolk: [() => talkFolk, v => ((talkFolk = v), provide({ talkFolk }))],
  talkHide: [() => talkHide, v => (talkHide = v)],
  talkLetters: [() => talkLetters, v => (talkLetters = v)],
  talkLine: [() => talkLine, v => (talkLine = v)],
  talkLogClose: [() => talkLogClose, v => (talkLogClose = v)],
  talkLogOpen: [() => talkLogOpen, v => (talkLogOpen = v)],
  talkMiniPortrait: [() => talkMiniPortrait, v => (talkMiniPortrait = v)],
  talkMotion: [() => talkMotion, v => (talkMotion = v)],
  talkName: [() => talkName, v => (talkName = v)],
  talkPortraitFrame: [() => talkPortraitFrame, v => (talkPortraitFrame = v)],
  talkStackClear: [() => talkStackClear, v => (talkStackClear = v)],
  talkStackFit: [() => talkStackFit, v => (talkStackFit = v)],
  talkStamp: [() => talkStamp, v => (talkStamp = v)],
  talkTick: [() => talkTick, v => (talkTick = v)],
});
/* eslint-enable no-func-assign */
provide({ talkFolk });
/* to-module: end */
/* onType (phase 06-3): functions called for each character typed, ({ who, ch, n, done }); phase 07's mouths use it */
export const talkBox = {
  on: false,
  cur: null,
  por: /** @type {{ who: string | null, expr: string | null, t: number, creature?: boolean }} */ ({
    who: null,
    expr: null,
    t: 0,
  }),
  el: null,
  onType: /** @type {((e: { who: string, ch: string, n: number, done: boolean }) => void)[]} */ ([]),
  /* Project Story: the choice on screen (talkChoose), if any */
  choice: /** @type {{ pick: (i: number) => void, n: number } | null} */ (null),
  /* DL-4: the stack (logic/talk-stack.js stackStep's state), the conversation's plain lines for the Log (in memory
     only: never saved, never sent; cleared when the talk closes), and who has spoken since it opened */
  stack: /** @type {any} */ (null),
  log: /** @type {{ name: string, text: string }[]} */ ([]),
  spoke: /** @type {Set<string>} */ (new Set()),
  /** the newest line's speaker, its name, the plain text shown and whether it was cut off (for its demotion) */
  last: /** @type {{ who: string, name: string, text: string, cut: boolean, expr?: string | null } | null} */ (null),
  /** the share of the screen's height the stack covers, from the bottom (0 when the talk is closed) */
  cover: 0,
  /** DL-5: the newest line's face (logic/talk-director.js talkDirector), and the portrait's pictures kept per speaker
   * and face while the talk is open */
  dir: /** @type {ReturnType<typeof talkDirector> | null} */ (null),
  frames: /** @type {Map<string, HTMLCanvasElement>} */ (new Map()),
};
provide({ talkBox }); /* to-module */
const SPEAKER_NAMES = { chosen: 'Professor Chosen' };
/** DL-3: how many held shapes a shout's burst has (logic/ui-theme.js UI_SHAPE_FAMILIES bubbleShout.variants) */
const BURST_VARIANTS = 3;
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
    /* phase 06-3: the portrait framed in its own 96×96 slot inside the box, a name tag over the line (css/dialogue.css).
       DL-4: the box is the newest bubble of a stack; the older ones go above it (talkDemote), the "…" shows in
       .talk-wait, the Log button opens the conversation so far (talkLogOpen) */
    '<div class="talk-stack"><div class="talk-box px" role="dialog" aria-live="polite"><span class="talk-slot"><canvas class="talk-por" aria-hidden="true"></canvas></span><div class="talk-txt"><p class="talk-who"></p><p class="talk-line"></p><span class="talk-wait" aria-hidden="true"><i></i><i></i><i></i></span></div><span class="talk-more" aria-hidden="true">▼</span><button type="button" class="talk-logbtn">Log</button><span class="talk-deco" aria-hidden="true"><i class="talk-shine"></i><b class="talk-form"></b></span><span class="talk-dots" aria-hidden="true"><i></i><i></i><i></i></span></div></div>';
  el.querySelector('.talk-logbtn').addEventListener('click', ev => {
    ev.stopPropagation();
    talkLogOpen();
  });
  el.addEventListener('click', ev => {
    /* DL-4: a tap anywhere closes the Log, and doesn't go on with the talk */
    if (talkLogClose()) return;
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
/* DL-3: how a bubble moves, from the theme's --bubble-* (uiTheme.json motion; tokens.css) and the skin's entrance */
function talkMotion(box, entrance) {
  const css = getComputedStyle(box),
    num = (/** @type {string} */ k, /** @type {number} */ d) => {
      const v = parseFloat(css.getPropertyValue(k));
      return Number.isFinite(v) ? v : d;
    };
  /* the theme writes the spring as an easing and its length (logic/ui-theme.js, logic/motion.js springEase) */
  let ease = css.getPropertyValue('--bubble-spring').trim() || 'cubic-bezier(0.3, 1.6, 0.5, 1)',
    ms = num('--bubble-spring-ms', 420);
  /* soft (Kappi): slower and gentler, no overshoot */
  if (entrance === 'soft') {
    ease = 'cubic-bezier(0.25, 0.8, 0.3, 1)';
    ms = Math.round(ms * 1.5);
  }
  return { ease, ms, pop: Math.min(1, Math.max(0.3, num('--bubble-pop', 0.6))) };
}
/* DL-3: the bubble's look for a line: its skin (talkSkins.json, logic/talk-skins.js), the shape its tone takes, the
   tilt and the burst picked by the line, a folk speaker's accent, the Bureau's form number */
function talkDress(box, who, text, style, o) {
  const skin = talkSkinOf(TALK_SKINS, who, o),
    S = /** @type {any} */ (TALK_SKINS.skins || {})[skin] || {},
    seed = talkSeed(text, who),
    fam =
      style === 'shout'
        ? `bubbleShout-${talkVariant(seed, BURST_VARIANTS)}`
        : style === 'think'
          ? 'bubbleThink'
          : S.family || 'bubble';
  box.dataset.skin = skin;
  box.dataset.shape = style;
  /* DL-4: the side comes from the stack (logic/talk-stack.js stackStep: alternating, narration in the middle) */
  box.dataset.side = o.side || 'left';
  box.style.setProperty('--talk-clip', `var(--clip-${fam})`);
  box.style.setProperty('--talk-edge', `var(--edge-${fam})`);
  /* the frame tilts (a whole bubble's lean, picked once by the line), the letters stay level */
  box.style.setProperty('--tilt-k', String(talkTilt(seed, 1, S.tilt ?? 1)));
  box.style.setProperty('--talk-slant', `${S.slant || 0}deg`);
  box.style.setProperty('--talk-hue', String(talkAccentHue(who)));
  const forms = (S.deco || []).includes('form') ? FACTIONS.bureau?.look?.forms || [] : [];
  box.querySelector('.talk-form').textContent = forms.length ? forms[seed % forms.length] : '';
  for (const old of box.querySelectorAll('.talk-stamp')) old.remove();
  return { skin, S, seed };
}
/* DL-3: a line's [stamp=word] lands on a bubble whose skin takes stamps (the Bureau's): the style track's pb-stamp
   (it slams and thunks by itself, ui-run-kit.js), a little crooked by the line's seed, and the bubble gives a small
   thump as it lands */
function talkStamp(box, word, seed) {
  const at = document.createElement('span');
  at.className = 'talk-stamp';
  const st = document.createElement('pb-stamp');
  st.setAttribute('word', String(word).toUpperCase());
  st.setAttribute('tilt', String((seed % 2 ? 1 : -1) * (6 + (seed % 7))));
  at.append(st);
  at.addEventListener(
    'pb-stamp-land',
    () => {
      if (box.animate && !reducedMotion)
        box.animate([{ translate: '0 2px' }, { translate: '0 0' }], { duration: 160, easing: 'ease-out' });
    },
    { once: true }
  );
  box.append(at);
}
/* one line; the box stays open for the next one until talkHide() */
export function talkLine(who, text, expr, o = {}) {
  const el = talkEl();
  /* DL-1: the line's markup read once (logic/line-markup.js); talkBox.cur.text stays the plain line. DL-2: its letters
     drawn as spans with their effects (talkLetters), shown on the times logic/talk-type.js gives */
  const full = parseLine(text || ''),
    /* DL-4: a line with a cut ([cut], or ending in —) shows up to the cut and goes on by itself */
    cut = cutAt(full),
    parsed = cut >= 0 ? talkCutLine(full, cut) : full;
  expr = expr || parsed.expr;
  text = parsed.plain;
  const shown = !el.hidden;
  if (!shown) talkStackClear(el);
  el.hidden = false;
  el.classList.toggle('in-cs', !!o.cs);
  el.classList.toggle('scrim', !!o.scrim);
  document.body.classList.add('talking');
  const box = el.querySelector('.talk-box:not(.talk-old)'),
    line = el.querySelector('.talk-line'),
    style0 = parsed.style.find(s => s === 'shout' || s === 'whisper' || s === 'think') || '',
    name = o.name || talkName(who),
    skin = talkSkinOf(TALK_SKINS, who, o),
    /* DL-4: where the bubble goes; the line before it moves up the stack */
    step = stackStep(talkBox.stack, { who, skin, style: style0, cut: cut >= 0 });
  if (shown && talkBox.stack) talkDemote(el, box, step);
  talkBox.stack = step.state;
  el.querySelector('.talk-who').textContent = name;
  box.classList.remove('done');
  const dress = talkDress(box, who, text, style0, { ...o, side: step.side });
  /* DL-4: the "…" first: before a [wait] line (anyone's), and before the first line of a skin that waits ("wait":
     "first" in talkSkins.json: Kappi); not under Reduced */
  const waits =
      !reducedMotion && (parsed.style.includes('wait') || (dress.S.wait === 'first' && !talkBox.spoke.has(skin))),
    waitFor = waits ? waitMs(dress.seed) : 0;
  talkBox.spoke.add(skin);
  talkBox.last = { who, name, text, cut: cut >= 0, expr: expr || null };
  /* DL-5: the face's director for this line; the older bubbles of anyone else are the listeners, dimmed */
  box.dataset.who = who;
  for (const o of el.querySelectorAll('.talk-old'))
    o.classList.toggle('listening', /** @type {HTMLElement} */ (o).dataset.who !== who);
  talkBox.dir = talkDirector({
    seed: dress.seed,
    expr: expr || null,
    events: parsed.events,
    reduced: reducedMotion || document.documentElement.dataset.motion === 'reduced',
    auto: EMOTES.auto,
    blinkAt: talkBox.dir?.nextBlink(),
  });
  talkBox.log.push({ name, text });
  box.classList.toggle('waiting', waits);
  const letters = talkLetters(line, parsed),
    chars = [...text],
    speed = reducedMotion
      ? 'instant'
      : (typeof saveData !== 'undefined' && saveData?.preferences?.textSpeed) || 'normal',
    times = letterTimes(parsed, speed).at,
    style = style0,
    stamps = (dress.S.deco || []).includes('stamp')
      ? parsed.events.filter(e => e.kind === 'stamp').sort((a, b) => a.at - b.at)
      : [];
  /* DL-4: every line is a new bubble now: it pops in from its side (the one before went up the stack); after a "…" it
     grows from the dots to fit the line (talkWaitEnd) */
  talkArrive(box, false, 0, dress);
  talkStackFit(el);
  talkBox.on = true;
  talkBox.por = { who, expr: expr || null, t: 0 };
  if (!talkBox.loop) {
    talkBox.loop = true;
    frameTask('talk', talkTick, () => 30);
  }
  return new Promise(res => {
    const st = { who, text, parsed, n: 0, t0: performance.now() + waitFor, typing: true, res, wait: 0 };
    talkBox.cur = st;
    let blipN = 0;
    /* DL-4: the "…" ends: the dots go, the bubble grows to the line on its spring, the letters start */
    const waitEnd = () => {
      if (!st.wait) return;
      clearTimeout(st.wait);
      st.wait = 0;
      st.t0 = performance.now();
      const h0 = box.offsetHeight;
      box.classList.remove('waiting');
      talkArrive(box, true, h0, dress);
      talkStackFit(el);
    };
    const step = () => {
      if (talkBox.cur !== st) return;
      if (st.wait) return requestAnimationFrame(step);
      const n0 = st.n,
        now = performance.now() - st.t0;
      let n = n0;
      while (n < chars.length && times[n] <= now) n++;
      st.n = n;
      for (let i = n0; i < n; i++) letters[i]?.classList.add('on');
      /* DL-5: the face's events at the letters reached ([face=x], [emote=x]); the letters themselves reach it through
         onType */
      const D = talkBox.dir;
      if (D) {
        D.start(performance.now());
        D.reach(n, performance.now());
      }
      /* DL-3: a stamp lands when the letters reach it */
      while (stamps.length && stamps[0].at <= n) talkStamp(box, stamps.shift().v, dress.seed);
      /* phase 06-3: the typing hook (phase 07's mouth animation listens here): each new character, who says it */
      if (talkBox.onType.length)
        for (let i = n0; i < n; i++)
          for (const f of talkBox.onType) f({ who, ch: chars[i], n: i + 1, done: i + 1 >= chars.length });
      /* the voice every 3 letters, in the line's style (a thought is silent) */
      const b = Math.floor(n / 3);
      if (b > blipN && n < chars.length) {
        blipN = b;
        if (typeof soundEffect === 'function' && style !== 'think' && /\w/.test(chars[n] || ''))
          soundEffect('blip', {
            who,
            style,
            big: !!letters[n]?.classList.contains('fx-big'),
            voice: dress.S.blip,
          });
      }
      if (n >= chars.length) {
        st.typing = false;
        D?.done();
        box.classList.add('done');
        /* DL-4: an interrupted line goes on by itself, 250 ms after it breaks off */
        if (cut >= 0) setTimeout(() => st.done(), 250);
        return;
      }
      requestAnimationFrame(step);
    };
    if (waitFor) st.wait = setTimeout(waitEnd, waitFor);
    step();
    st.tap = () => {
      if (st.wait) return waitEnd();
      if (st.typing) {
        st.t0 = -1e9;
        return;
      }
      if (cut >= 0) return;
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
/* DL-3: a bubble arrives. Opening, it pops in from the speaker's side on the bubble's spring (Kappi's softly, narration
   with a fade); a new line in an open box grows the frame to fit from its old height (the line is laid out before it
   types, so this happens once) and gives a small squash. A shout lands with a squash, a rebound and one shake; Chosen's
   gold shines once. Only transform-like properties and opacity move (the box's `scale` and `translate`, the layers'
   --grow); Reduced: a fade when it opens, nothing else */
function talkArrive(box, shown, h0, dress) {
  if (!box.animate) return;
  const reduced = reducedMotion || document.documentElement.dataset.motion === 'reduced';
  if (reduced) {
    if (!shown) box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    return;
  }
  const M = talkMotion(box, dress.S.entrance),
    from = dress.S.entrance === 'still' ? 0.98 : M.pop;
  if (!shown) {
    const side = box.dataset.side === 'right' ? 10 : -10;
    box.animate(
      [
        { opacity: 0, scale: String(from), translate: `${side}px 0` },
        { opacity: 1, offset: 0.25 },
        { opacity: 1, scale: '1', translate: '0 0' },
      ],
      { duration: M.ms, easing: M.ease }
    );
  } else {
    const h1 = box.offsetHeight;
    if (h0 && h1 && Math.abs(h1 - h0) > 1)
      box.animate([{ '--grow': String(h0 / h1) }, { '--grow': '1' }], { duration: M.ms, easing: M.ease });
    if (dress.S.entrance !== 'still')
      box.animate([{ scale: '0.975 0.95' }, { scale: '1 1' }], { duration: M.ms, easing: M.ease });
  }
  if (box.dataset.shape === 'shout')
    box.animate(
      [
        { scale: '1.15 0.85', translate: '0 0' },
        { scale: '0.96 1.04', translate: '3px 0', offset: 0.35 },
        { scale: '1 1', translate: '-2px 0', offset: 0.6 },
        { scale: '1 1', translate: '0 0' },
      ],
      { duration: 260, easing: 'ease-out', composite: 'add' }
    );
  if ((dress.S.deco || []).includes('shine'))
    box.querySelector('.talk-shine')?.animate(
      [
        { translate: '-120% 0', opacity: 1 },
        { translate: '420% 0', opacity: 1 },
      ],
      {
        duration: 700,
        delay: 120,
        easing: 'ease-in-out',
      }
    );
}
export function talkHide() {
  const el = talkBox.el;
  if (el) {
    el.hidden = true;
    talkStackClear(el);
  }
  if (talkBox.cur?.wait) clearTimeout(talkBox.cur.wait);
  talkBox.cur = null;
  talkBox.cover = 0;
  talkBox.on = false;
  document.body.classList.remove('talking');
}
/* Project Story: a choice after a line, its options as buttons over the box's top corner; tap one, or press 1-9. The
   line before it stays on screen. Resolves with the option's index. */
export function talkChoose(options) {
  const el = talkEl(),
    box = el.querySelector('.talk-box:not(.talk-old)');
  el.hidden = false;
  talkBox.on = true;
  document.body.classList.add('talking');
  box.classList.add('done');
  box.querySelector('.talk-choices')?.remove();
  /* DL-4: the options take the older bubbles' place above the newest, away from its tail */
  const stack = el.querySelector('.talk-stack');
  stack.classList.add('choosing');
  const list = document.createElement('div');
  list.className = 'talk-choices';
  list.setAttribute('role', 'group');
  return new Promise(res => {
    const pick = i => {
      if (talkBox.choice !== C) return;
      talkBox.choice = null;
      list.remove();
      stack.classList.remove('choosing');
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
/* ---------- DL-4: the stack ---------- */
/** a line cut off at `at`: only the letters before it show, and a dash ends it when it broke off mid-line
 * @param {any} P logic/line-markup.js parseLine's answer @param {number} at */
function talkCutLine(P, at) {
  const chars = [...P.plain];
  if (at >= chars.length) return P;
  let plain = chars.slice(0, at).join('').replace(/\s+$/, '');
  const n = [...plain].length;
  if (!plain.endsWith('—')) plain += '—';
  return {
    ...P,
    plain,
    runs: P.runs.filter(r => r.from < n).map(r => ({ ...r, to: Math.min(r.to, n) })),
    events: P.events.filter(e => e.at <= n && e.kind !== 'cut'),
  };
}
/** the stack empties: older bubbles, the Log, who has spoken */
function talkStackClear(el) {
  for (const old of el.querySelectorAll('.talk-old,.talk-log')) old.remove();
  el.querySelector('.talk-stack')?.classList.remove('choosing');
  talkBox.stack = null;
  talkBox.log = [];
  talkBox.spoke = new Set();
  talkBox.last = null;
  talkBox.dir = null;
  talkBox.frames.clear();
}
/** the speaker's portrait, small, for an older bubble: a whole number of device pixels per art pixel */
function talkMiniPortrait(who, expr) {
  const src = document.createElement('canvas'),
    cv = document.createElement('canvas');
  cv.className = 'talk-mini';
  cv.setAttribute('aria-hidden', 'true');
  try {
    drawPortrait(src, who, expr, performance.now());
  } catch (e) {
    return cv;
  }
  if (!src.width || !src.height) return cv;
  const dpr = devicePixelRatio || 1,
    k = Math.max(1, Math.floor((44 * dpr) / src.width));
  cv.width = src.width * k;
  cv.height = src.height * k;
  cv.style.width = cv.width / dpr + 'px';
  cv.style.height = cv.height / dpr + 'px';
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}
/** the newest bubble moves up the stack as a copy of itself: its name tag becomes .talk-was and its line .talk-said
 * (so only the newest has .talk-who and .talk-line), one piece for the element count, hidden from screen readers (the
 * Log has every line); the older ones move up one, the oldest leaves. Then they slide to their places (FLIP) */
function talkDemote(el, box, step) {
  const L = talkBox.last;
  if (!L) return;
  const olds = [...el.querySelectorAll('.talk-old')],
    first = new Map(olds.map(o => [o, { r: o.getBoundingClientRect(), k: getComputedStyle(o).scale }])),
    boxAt = box.getBoundingClientRect();
  const c = /** @type {HTMLElement} */ (box.cloneNode(true));
  c.classList.remove('done', 'waiting');
  c.classList.add('talk-old', 'was-1');
  c.removeAttribute('role');
  c.removeAttribute('aria-live');
  c.setAttribute('aria-hidden', 'true');
  c.inert = true;
  c.dataset.onePiece = '';
  for (const q of c.querySelectorAll('.talk-more,.talk-logbtn,.talk-wait,.talk-choices,.talk-por,.talk-emote'))
    q.remove();
  for (const q of c.querySelectorAll('pb-stamp')) q.setAttribute('still', '');
  c.querySelector('.talk-slot')?.append(talkMiniPortrait(L.who, L.expr));
  /* the name as a small tag at the start of the line, the line clamped to two rows (dialogue.css) */
  const said = document.createElement('p'),
    was = document.createElement('b');
  was.className = 'talk-was';
  was.textContent = L.name;
  said.className = 'talk-said';
  said.append(was, ' ', L.text);
  c.querySelector('.talk-who')?.remove();
  c.querySelector('.talk-line')?.replaceWith(said);
  /* one speaker again: the older bubble drops its portrait and name and a bridge joins it to the newer one */
  if (step.linked) {
    c.classList.add('linked');
    const br = document.createElement('i');
    br.className = 'talk-bridge';
    br.setAttribute('aria-hidden', 'true');
    c.append(br);
  }
  if (L.cut) {
    const K = knockOf(c.dataset.side);
    c.classList.add('knocked');
    c.style.setProperty('--knock-deg', `${K.deg}deg`);
    c.style.setProperty('--knock-px', `${K.px}px`);
  }
  for (const o of olds)
    if (o.classList.contains('was-2')) o.remove();
    else o.classList.replace('was-1', 'was-2');
  box.before(c);
  if (!box.animate || reducedMotion || document.documentElement.dataset.motion === 'reduced') return;
  const M = talkMotion(box, ''),
    kept = [...el.querySelectorAll('.talk-old')];
  const one = (/** @type {string} */ v) => (!v || v === 'none' ? '1' : v);
  for (const o of kept) {
    const F = o === c ? { r: boxAt, k: '1' } : first.get(o);
    if (!F) continue;
    const a = F.r,
      b = o.getBoundingClientRect(),
      cs = getComputedStyle(o),
      rest = cs.translate === 'none' ? '0px 0px' : cs.translate;
    o.animate(
      [
        { translate: `${a.left - b.left}px ${a.bottom - b.bottom}px`, scale: one(F.k) },
        { translate: rest, scale: one(cs.scale) },
      ],
      { duration: M.ms, easing: M.ease }
    );
  }
}
/** the height budget: older bubbles leave, the oldest first, while the stack would reach over 40% of the screen's
 * height above the bottom bar (logic/talk-stack.js stackFit) */
function talkStackFit(el) {
  const box = el.querySelector('.talk-box:not(.talk-old)'),
    stack = el.querySelector('.talk-stack'),
    olds = [...el.querySelectorAll('.talk-old')].reverse();
  if (olds.length) {
    const gap = parseFloat(getComputedStyle(stack).rowGap) || 0,
      k = stackFit([box.offsetHeight, ...olds.map(o => o.offsetHeight)], { vh: innerHeight, gap });
    for (const o of olds.slice(k)) o.remove();
  }
  /* the share of the screen's height the stack covers from the bottom (its top's tail included), for the camera's
     two-shot (walk/camera.js) */
  const top =
    stack.getBoundingClientRect().top - (parseFloat(getComputedStyle(box).getPropertyValue('--bubble-tail')) || 18);
  talkBox.cover = innerHeight > 0 ? Math.max(0, Math.min(1, 1 - top / innerHeight)) : 0;
}
/** the Log: the open conversation's lines so far, scrollable; a tap closes it */
function talkLogOpen() {
  const el = talkEl();
  talkLogClose();
  const log = document.createElement('div');
  log.className = 'talk-log px';
  log.setAttribute('role', 'dialog');
  log.setAttribute('aria-label', 'Conversation so far');
  const h = document.createElement('p');
  h.className = 'talk-log-head';
  h.textContent = 'Log';
  const list = document.createElement('ol');
  for (const L of talkBox.log) {
    const li = document.createElement('li'),
      b = document.createElement('b');
    b.textContent = L.name;
    li.append(b, ' ', L.text);
    list.append(li);
  }
  log.append(h, list);
  el.append(log);
  list.lastElementChild?.scrollIntoView({ block: 'end' });
}
/** closes the Log if it is open; true if it was */
function talkLogClose() {
  const log = talkBox.el?.querySelector('.talk-log');
  if (!log) return false;
  log.remove();
  return true;
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
  const src = talkPortraitFrame(who, ex, ts);
  if (!src || !src.width || !src.height) return;
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
/** DL-5: the speaker's portrait with a face (a combination like 'happy+talk'): a person's pictures are kept per face
 * and breath (three steps of person-art.js's idle breathing) while the talk is open, so a blink or a mouth costs a
 * copy, not a new drawing; a creature (Kappi) moves on its own clock and is drawn each time */
function talkPortraitFrame(who, ex, ts) {
  const P = talkBox.por;
  if (P.creature === undefined) {
    try {
      P.creature = !!(/** @type {any} */ (lookOf(who))?.creature);
    } catch (e) {
      P.creature = false;
    }
  }
  if (P.creature) {
    const src = talkBox.src || (talkBox.src = document.createElement('canvas'));
    drawPortrait(src, who, ex, ts);
    return src;
  }
  const breath = Math.round(Math.sin(ts / 650)),
    key = who + '|' + (ex || '') + '|' + breath;
  let c = talkBox.frames.get(key);
  if (!c) {
    c = document.createElement('canvas');
    drawPortrait(c, who, ex, 650 * Math.asin(breath));
    talkBox.frames.set(key, c);
  }
  return c;
}
function talkTick(ts) {
  const P = talkBox.por,
    el = talkBox.el;
  if (!talkBox.on || !el || el.hidden || !P.who) {
    talkBox.loop = false;
    frameStop('talk');
    return;
  }
  if (ts - P.t < 50) return;
  P.t = ts;
  /* DL-5: the director says the face (blinks, the mouth, the line's face), and what starts now: an emote, the frame's
     bounce, a new face (kept for the line's small portrait once it moves up the stack) */
  const D = talkBox.dir,
    S = D ? D.at(performance.now()) : null,
    box = el.querySelector('.talk-box:not(.talk-old)'),
    slot = box?.querySelector('.talk-slot');
  if (D && slot)
    for (const p of D.drain())
      if (p.kind === 'bounce') talkBounce(slot);
      else if (p.kind === 'emote' && p.v) talkEmote(slot, p.v);
      else if (p.kind === 'face' && talkBox.last) talkBox.last.expr = p.v || null;
  const ex = S ? S.combo : P.expr;
  try {
    drawTalkPortrait(el.querySelector('.talk-por'), P.who, ex, ts);
  } catch (e) {}
}
/** DL-5: the circle behind the portrait squashes and springs back (the picture itself never stretches) */
function talkBounce(slot) {
  if (!slot.animate || reducedMotion || document.documentElement.dataset.motion === 'reduced') return;
  try {
    slot.animate(
      [{ scale: '1 1' }, { scale: '1.08 0.9', offset: 0.25 }, { scale: '0.96 1.04', offset: 0.6 }, { scale: '1 1' }],
      { duration: 380, easing: 'ease-out', pseudoElement: '::before' }
    );
  } catch (e) {}
}
/** DL-5: an emote's picture (emotes.json: a pixel grid, outlined), drawn once at a whole number of device pixels */
const talkEmoteArt = new Map();
function talkEmoteCanvas(v) {
  const E = EMOTES,
    rows = E.emotes[v];
  if (!rows) return null;
  const dpr = devicePixelRatio || 1,
    k = Math.max(1, Math.round(2 * dpr)),
    key = v + '|' + k;
  let art = talkEmoteArt.get(key);
  if (!art) {
    const n = E.size,
      c = document.createElement('canvas'),
      x = c.getContext('2d'),
      at = (/** @type {number} */ i, /** @type {number} */ j) =>
        i >= 0 && j >= 0 && i < n && j < n && rows[j][i] !== '.' && rows[j][i] !== undefined;
    c.width = c.height = n * k;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const fill = at(i, j)
          ? E.colors[rows[j][i]]
          : at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)
            ? E.outline
            : '';
        if (!fill) continue;
        x.fillStyle = fill;
        x.fillRect(i * k, j * k, k, k);
      }
    talkEmoteArt.set(key, (art = c));
  }
  const cv = document.createElement('canvas');
  cv.className = 'talk-emote';
  cv.setAttribute('aria-hidden', 'true');
  cv.dataset.emote = v;
  cv.width = art.width;
  cv.height = art.height;
  cv.style.width = art.width / dpr + 'px';
  cv.style.height = art.height / dpr + 'px';
  cv.getContext('2d').drawImage(art, 0, 0);
  return cv;
}
/** DL-5: an emote pops beside the head (0 → 1.2 → 1 over 200 ms; Reduced: no pop) and fades after about a second
 * (logic/talk-director.js emoteAt has the same times) */
function talkEmote(slot, v) {
  for (const o of slot.querySelectorAll('.talk-emote')) o.remove();
  const cv = talkEmoteCanvas(v);
  if (!cv) return;
  slot.append(cv);
  const reduced = reducedMotion || document.documentElement.dataset.motion === 'reduced';
  if (cv.animate) {
    if (!reduced)
      cv.animate([{ scale: '0' }, { scale: '1.2', offset: 0.6 }, { scale: '1' }], {
        duration: 200,
        easing: 'ease-out',
      });
    cv.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: EMOTE_MS - 1000,
      delay: 1000,
      fill: 'forwards',
    }).onfinish = () => cv.remove();
  } else setTimeout(() => cv.remove(), EMOTE_MS);
}
/* DL-5: the director hears every letter typed (phase 06-3's onType hook): vowels open the mouth */
talkBox.onType.push(e => talkBox.dir?.type(e.ch, performance.now()));
document.addEventListener('keydown', ev => {
  if (talkBox.choice && /^[1-9]$/.test(ev.key) && +ev.key <= talkBox.choice.n) {
    ev.preventDefault();
    talkBox.choice.pick(+ev.key - 1);
    return;
  }
  if (!talkBox.cur || talkBox.el.hidden) return;
  if (ev.key === 'Escape' && talkLogClose()) return;
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    if (talkLogClose()) return;
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
