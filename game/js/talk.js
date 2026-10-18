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
import { RM, S } from './game-state.js';
import { frameStop, frameTask } from './frame-scheduler.js';
import { trPortrait, trainerLook } from './person-art.js';
import { dioFace, walkView } from './walk-view.js';
import { walkRenderer } from './walk-view-gl.js';
import { sfx } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  FOLK_NAMES: [() => FOLK_NAMES],
  FOLK_TALK: [() => FOLK_TALK],
  TALK: [() => TALK],
  TALK_NAMES: [() => TALK_NAMES],
  setTalkFolk: [() => setTalkFolk, v => (setTalkFolk = v)],
  talk: [() => talk, v => (talk = v)],
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
export const TALK = { on: false, cur: null, por: { who: null, expr: null, t: 0 }, el: null };
const TALK_NAMES = { gini: 'Professor Hazel' };
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
  if (who === 'me') return trainerLook('me').name || 'You';
  if (typeof who === 'string' && who.startsWith('folk:')) return FOLK_NAMES[+who.slice(5) % FOLK_NAMES.length];
  return (
    TALK_NAMES[who] ||
    (typeof PEOPLE !== 'undefined' &&
      PEOPLE[who] &&
      ((PEOPLE[who].look && PEOPLE[who].look.name) || PEOPLE[who].name)) ||
    ((typeof TRAINERS !== 'undefined' && Object.values(TRAINERS).find(t => t.who === who)) || {}).name ||
    'Someone'
  );
}
function talkEl() {
  let el = TALK.el;
  if (el && el.isConnected) return el;
  el = document.createElement('div');
  el.id = 'talk';
  el.className = 'talk-layer';
  el.hidden = true;
  el.innerHTML =
    '<div class="talk-box px" role="dialog" aria-live="polite"><canvas class="talk-por" aria-hidden="true"></canvas><div class="talk-txt"><p class="talk-who"></p><p class="talk-line"></p></div><span class="talk-more" aria-hidden="true">▼</span></div>';
  el.addEventListener('click', ev => {
    if (ev.target.closest('button,a,input')) return;
    if (TALK.cur) TALK.cur.tap();
  });
  document.body.appendChild(el);
  TALK.el = el;
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
  TALK.on = true;
  TALK.por = { who, expr: expr || null, t: 0 };
  if (!TALK.loop) {
    TALK.loop = true;
    frameTask('talk', talkTick, () => 30);
  }
  return new Promise(res => {
    const st = { who, text, n: 0, t0: performance.now(), typing: true, res };
    TALK.cur = st;
    let blipN = 0;
    const step = () => {
      if (TALK.cur !== st) return;
      st.n = RM ? text.length : Math.min(text.length, Math.floor((performance.now() - st.t0) / 28));
      line.textContent = text.slice(0, st.n);
      const b = Math.floor(st.n / 3);
      if (b > blipN && st.n < text.length) {
        blipN = b;
        if (typeof sfx === 'function' && /\w/.test(text[st.n] || '')) sfx('blip', { who });
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
      if (typeof sfx === 'function') sfx('tick');
      st.done();
    };
    st.done = () => {
      if (TALK.cur !== st) return;
      TALK.cur = null;
      res();
    };
  });
}
export function talkHide() {
  const el = TALK.el;
  if (el) el.hidden = true;
  TALK.cur = null;
  TALK.on = false;
  document.body.classList.remove('talking');
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
  const P = TALK.por,
    el = TALK.el;
  if (!TALK.on || !el || el.hidden || !P.who) {
    TALK.loop = false;
    frameStop('talk');
    return;
  }
  if (ts - P.t < 70) return;
  P.t = ts;
  const typing = TALK.cur && TALK.cur.typing,
    blink = ts % 3700 < 130 && P.expr !== 'happy';
  const ex = blink ? 'blink' : typing && !P.expr && Math.floor(ts / 120) % 2 ? 'talk' : P.expr;
  try {
    trPortrait(el.querySelector('.talk-por'), P.who, ex, ts);
  } catch (e) {}
}
document.addEventListener('keydown', ev => {
  if (!TALK.cur || TALK.el.hidden) return;
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    TALK.cur.tap();
  }
});

/* ---------- people in the walk scenes ---------- */
const FOLK_TALK = [
  '[happy] Oh, hi! Out for a walk too?',
  'Did you hear? Someone saw a Golden one near the pond.',
  'My feet are tired, but my step counter is happy.',
  '[surprised] Is that a trainer card? Fancy!',
  'I used to have a Billie. It bought my house and moved me out.',
  'Every step counts, they say. I counted. They do.',
  '[happy] Lovely day under the Inner Sun.',
  'Careful in the tall grass. They hide in there.',
];
export async function talkFolk(f) {
  if (TALK.on) return;
  const sc = walkView.sc,
    L = typeof mapChatLines === 'function' ? mapChatLines(FOLK_TALK) : sc.chat && sc.chat.length ? sc.chat : FOLK_TALK,
    who = 'folk:' + f.seed,
    a = L[(f.line + (walkView.chat = (walkView.chat || 0) + 1)) % L.length],
    b = FOLK_TALK[(f.seed + walkView.chat) % FOLK_TALK.length];
  f.wait = 99;
  f.route = null;
  f.walk = 0;
  dioFace(f);
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
  if (TALK.on) return;
  const caught = Object.keys(S.caught).length,
    badges = (S.seats || []).length,
    nm = trainerLook('me').name || 'Trainer';
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
  if (S.flags && S.flags.chad && !S.flags.chad2)
    tips.push('Blake was here earlier, bragging. He said he’d wait for you in Clovercrest Town.');
  await talk(tips.map(t => ['gini', t]));
}
