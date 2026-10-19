'use strict';
/* ================= CONVERSATIONS =================
   One dialogue box for everyone who talks: Professor Hazel, your rival Blake, townsfolk, trainers and the opening cutscene.
   A portrait that blinks and moves its mouth while the line types out, the speaker's name, a voice blip per few
   letters (sound.js), tap or Enter to finish the line or go on. Lines may start with an expression in brackets:
   "[happy] Nice to meet you!" (happy, surprised, sad, angry, blink, talk). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { mapChatLines, provide } from './hooks.js';
import { PEOPLE, TRAINERS } from './game-data.js';
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
  setTalkFolk: [() => setTalkFolk, v => (setTalkFolk = v)],
  talk: [() => talk, v => (talk = v)],
  talkBox: [() => talkBox],
  talkChoose: [() => talkChoose, v => (talkChoose = v)],
  talkEl: [() => talkEl, v => (talkEl = v)],
  talkFolk: [() => talkFolk, v => setTalkFolk(v)],
  talkHazel: [() => talkHazel, v => (talkHazel = v)],
  talkHide: [() => talkHide, v => (talkHide = v)],
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
const SPEAKER_NAMES = { gini: 'Professor Hazel' };
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
/* one line; the box stays open for the next one until talkHide() */
export function talkLine(who, text, expr, o = {}) {
  const el = talkEl();
  let m = /^\[(\w+)\]\s*/.exec(text || '');
  if (m) {
    expr = expr || m[1];
    text = text.slice(m[0].length);
  }
  el.hidden = false;
  el.classList.toggle('in-cs', !!o.cs);
  el.classList.toggle('scrim', !!o.scrim);
  document.body.classList.add('talking');
  const box = el.querySelector('.talk-box'),
    line = el.querySelector('.talk-line');
  el.querySelector('.talk-who').textContent = o.name || talkName(who);
  box.classList.remove('done');
  line.textContent = '';
  talkBox.on = true;
  talkBox.por = { who, expr: expr || null, t: 0 };
  if (!talkBox.loop) {
    talkBox.loop = true;
    frameTask('talk', talkTick, () => 30);
  }
  return new Promise(res => {
    const st = { who, text, n: 0, t0: performance.now(), typing: true, res };
    talkBox.cur = st;
    let blipN = 0;
    const step = () => {
      if (talkBox.cur !== st) return;
      const n0 = st.n;
      st.n = reducedMotion ? text.length : Math.min(text.length, Math.floor((performance.now() - st.t0) / 28));
      line.textContent = text.slice(0, st.n);
      /* phase 06-3: the typing hook (phase 07's mouth animation listens here): each new character, who says it */
      if (talkBox.onType.length)
        for (let i = n0; i < st.n; i++)
          for (const f of talkBox.onType) f({ who, ch: text[i], n: i + 1, done: i + 1 >= text.length });
      const b = Math.floor(st.n / 3);
      if (b > blipN && st.n < text.length) {
        blipN = b;
        if (typeof soundEffect === 'function' && /\w/.test(text[st.n] || '')) soundEffect('blip', { who });
      }
      if (st.n >= text.length) {
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
      b.textContent = o.text;
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
    drawPortrait(el.querySelector('.talk-por'), P.who, ex, ts);
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
  'Did you hear? Someone saw a Golden one near the pond.',
  'My feet are tired, but I’ve seen three towns today.',
  '[surprised] Is that a trainer card? Fancy!',
  'I used to have a Billie. It bought my house and moved me out.',
  'A coin saved is a coin taxed, they say. I never know who says it.',
  '[happy] Lovely day under the Inner Sun.',
  'Careful in the tall grass. They hide in there.',
];
export async function talkFolk(f) {
  if (talkBox.on) return;
  const sc = walkView.sc,
    L = typeof mapChatLines === 'function' ? mapChatLines(FOLK_TALK) : sc.chat && sc.chat.length ? sc.chat : FOLK_TALK,
    who = 'folk:' + f.seed,
    a = L[(f.line + (walkView.chat = (walkView.chat || 0) + 1)) % L.length],
    b = FOLK_TALK[(f.seed + walkView.chat) % FOLK_TALK.length];
  f.wait = 99;
  f.route = null;
  f.walk = 0;
  turnToPlayer(f);
  if (typeof walkRenderer !== 'undefined') walkRenderer.focusT = { x: f.x, z: f.z, t: walkView.t };
  await talk([
    [who, a],
    [who, b === a ? FOLK_TALK[0] : b],
  ]);
  f.wait = 2;
}
/* phase 04d: things-to-do.js answers the person who asked a favour */
export function setTalkFolk(v) {
  talkFolk = v; // eslint-disable-line no-func-assign
  provide({ talkFolk });
}
export async function talkHazel(p) {
  if (talkBox.on) return;
  const caught = Object.keys(saveData.caught).length,
    badges = (saveData.seats || []).length,
    nm = lookOf('me').name || 'Trainer';
  const tips = [
    `[happy] ${nm}! How's your Index coming along? ${caught} taxed so far.`,
    caught < 5
      ? 'Try the tall grass on Hedgerow Lane, just down the road. Walk, and they come to you.'
      : caught < 15
        ? '[surprised] You’re getting good at this. Some of them only show up in caves or in the malls.'
        : '[happy] That’s a proper collection. I might have to cite you in my paper.',
    badges
      ? `${badges} badge${badges > 1 ? 's' : ''} already. The arena leaders talk about you, you know.`
      : 'When your team is ready, try an arena. The first one is in Fizzwell Town.',
  ];
  if (saveData.flags && saveData.flags.chad && !saveData.flags.chad2)
    tips.push('Blake was here earlier, bragging. He said he’d wait for you in Clovercrest Town.');
  await talk(tips.map(t => ['gini', t]));
}
