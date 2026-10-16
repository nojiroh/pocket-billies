'use strict';
/* ================= STORY SCENES IN THE WALK SCENES =================
   Short scenes filmed in the walk scene you are standing in, with the same director as the opening (cutscene.js):
   your rival Blake runs up the first time you reach him and talks before the battle; trainers talk with their
   portrait before a fight. A trainer's "intro" lines (game data) make the scene; "lines" are what they say in
   battle. S.story remembers which scenes you have seen. */
function storyFlags() {
  return S.story || (S.story = {});
}
/* tap a trainer in the scene, or their Battle button: they talk first, then the battle starts */
async function trainerTalk(id) {
  const T = TRAINERS[id];
  if (!T) return;
  if (TALK.on || (typeof CS !== 'undefined' && CS.on)) return;
  const F = storyFlags();
  if (T.intro && T.intro.length && !F['met_' + id] && !S.flags[id] && storyWorldOK()) {
    await rivalScene(T);
    return;
  }
  const lines = (
    S.flags[id] ? ['[happy] Back for more? All right!'] : (T.lines || []).map(l => l.replace(/^[“"]|[”"]$/g, ''))
  ).slice(0, 2);
  if (lines.length && typeof talk === 'function')
    await talk(lines.map((l, i) => [T.who, i ? l : l.startsWith('[') ? l : '[happy] ' + l]));
  startTrainer(id, { talked: true });
}
function storyWorldOK() {
  return typeof DGL !== 'undefined' && DGL.on && DIO.ready && DIO.cv && !B && typeof csFrame === 'function';
}
/* the director, borrowed for a scene in the current walk scene (no remount, no letterbox fade-in) */
function csWorldBegin() {
  CS.on = true;
  CS.run++;
  CS.skip = false;
  CS.actors = {};
  CS.stars = [];
  CS.coins = [];
  CS.fx = [];
  CS.flashes = [];
  CS.cam = null;
  CS.hide = null;
  CS.world = true;
  let el = $('#cs');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cs';
    el.className = 'cs';
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div class="cs-bars" aria-hidden="true"><i></i><i></i></div><button class="cs-skip pb small quiet" data-a="cs-skip">Skip ›</button><div class="cs-fade" id="csFade"></div>';
  el.hidden = false;
  document.body.classList.add('in-cs', 'cs-world');
  DIO.director = { frame: csFrame };
  return CS.run;
}
function csWorldEnd() {
  talkHide();
  CS.on = false;
  CS.run++;
  CS.skip = false;
  CS.world = false;
  csFlush();
  DIO.director = null;
  DGL.bt = null;
  DGL.camT = null;
  DGL.focus = null;
  const el = $('#cs');
  if (el) {
    el.hidden = true;
    el.innerHTML = '';
  }
  document.body.classList.remove('in-cs', 'cs-world');
  render();
}
/* Blake (or any trainer with intro lines) runs up to you, talks, and the battle starts */
async function rivalScene(T) {
  const run = csWorldBegin(),
    alive = () => CS.on && CS.run === run,
    P = DIO.pl,
    sc = DIO.sc,
    F = storyFlags();
  F['met_' + T.id] = 1;
  save();
  /* v47: "intro0" is for a game begun before the opening had Blake's first battle in it */
  const intro = T.intro0 && T.intro0.length && !F.rival0 ? T.intro0 : T.intro;
  if (typeof music === 'function') music('rival');
  try {
    /* where he comes from: the side of the scene away from the camera, a little to one side of you */
    const side = P.x < sc.w / 2 ? 1 : -1,
      to = dioFreePt(P.x + side * 1.4, P.z + 0.3),
      from = dioFreePt(clamp(P.x + side * 7, 1, sc.w - 1), clamp(P.z + 4.5, 1, sc.h - 1));
    csActor('me', 'me', [P.x, P.z], side > 0 ? 'sideR' : 'side');
    csActor('rival', T.who, from, 'down');
    CS.actors.rival.hidden = true;
    const mid = () => [(P.x + to[0]) / 2, (P.z + to[1]) / 2],
      m = mid(),
      gy = dioH(m[0], m[1]);
    csShot({ eye: [m[0], gy + 3.6, m[1] - 8.5], tgt: [m[0], gy + 1, m[1] + 1.5], fov: 38, w: 6 });
    await csWait(300);
    if (!alive()) return;
    /* "!" and he runs in */
    await talkLine(T.who, (intro[0] || 'Hey!').replace(/^\[\w+\]\s*/, ''), 'angry', {});
    talkHide();
    CS.actors.rival.hidden = false;
    csShot({ eye: [m[0], gy + 2.3, m[1] - 5.2], tgt: [m[0], gy + 1.05, m[1] + 0.4], fov: 38, w: 4 }, 1600);
    await csWalk('rival', to, 1500);
    if (!alive()) return;
    CS.actors.rival.dir = side > 0 ? 'side' : 'sideR';
    CS.actors.me.dir = side > 0 ? 'sideR' : 'side';
    for (const l of intro.slice(1)) {
      await csSay(T.who, l);
      if (!alive()) return;
    }
    csHideDlg();
    CS.actors.rival.act = 'cheer';
    CS.actors.rival.actT = csNow();
    await csWait(700);
    const f = $('#csFade');
    if (f) {
      f.style.background = '#0B0912';
      f.classList.add('on');
    }
    await new Promise(r => setTimeout(r, RM ? 50 : 450));
  } finally {
    csWorldEnd();
  }
  startTrainer(T.id, { talked: true });
}
/* when you arrive somewhere a story trainer waits, the scene starts by itself */
function storyCheck() {
  if (
    (typeof STEST !== 'undefined' && STEST.on) ||
    U.bench ||
    !S.started ||
    B ||
    U.modal ||
    U.tab !== 'walk' ||
    TALK.on ||
    (typeof CS !== 'undefined' && CS.on) ||
    (typeof DR !== 'undefined' && DR.on) ||
    !storyWorldOK()
  )
    return;
  if (S.route.prog !== 0 || (S.route.plan && S.route.plan.length)) return;
  const F = storyFlags();
  const T = trainersAt(S.route.node).find(T => T.intro && T.intro.length && !S.flags[T.id] && !F['met_' + T.id]);
  if (!T) return;
  if (STORY.pending === T.id) return;
  STORY.pending = T.id;
  setTimeout(() => {
    STORY.pending = null;
    if (DIO.ready && !B && U.tab === 'walk' && !U.modal && !TALK.on && !CS.on) rivalScene(T);
  }, 1400);
}
/* v39: the legendary encounters (rules.legends): one per scene, met when you arrive, once a day until caught */
function legendCheck() {
  if (
    !S.started ||
    B ||
    U.modal ||
    U.tab !== 'walk' ||
    TALK.on ||
    (typeof CS !== 'undefined' && CS.on) ||
    !DIO.ready ||
    (typeof STEST !== 'undefined' && STEST.on) ||
    U.bench
  )
    return;
  if (S.route.prog !== 0 || (S.route.plan && S.route.plan.length)) return;
  const F = storyFlags(),
    L = (RULES.legends || []).find(
      l => l.scene === dioBaseId() && SP[l.sp] && !S.caught[l.sp] && F['legend_' + l.sp] !== today()
    );
  if (!L || STORY.pending === 'legend') return;
  STORY.pending = 'legend';
  setTimeout(() => {
    STORY.pending = null;
    if (!DIO.ready || B || U.tab !== 'walk' || U.modal || TALK.on || CS.on || dioBaseId() !== L.scene) return;
    F['legend_' + L.sp] = today();
    save();
    modal({
      title: L.title,
      html: `<p>${esc(L.text)}</p><p class="note">${esc(L.line)}</p>`,
      btns: [
        {
          l: 'Face it',
          c: 'primary',
          f: () => {
            closeModal();
            const q = { id: 'legend-' + L.sp, sp: L.sp, lvl: L.lvl, gold: false, no: ++S.serial, legend: true };
            S.queue.push(q);
            startWild(q);
          },
        },
        { l: 'Back away', c: 'quiet', f: closeModal },
      ],
    });
  }, 1200);
}
const STORY = { pending: null };
/* alpha 0.4: someone who only talks (scene.people: Granny Juniper): what they say the first time, then a line or two */
async function personTalk(P) {
  if (!P || TALK.on || (typeof CS !== 'undefined' && CS.on)) return;
  const F = storyFlags(),
    k = 'met_' + P.id,
    first = !F[k] && P.first && P.first.length;
  let lines;
  if (first) lines = P.first;
  else {
    const L = P.lines || [];
    F['talk_' + P.id] = ((F['talk_' + P.id] || 0) + 1) % Math.max(1, L.length);
    const a = L[F['talk_' + P.id]];
    lines = a ? [a] : [];
  }
  F[k] = 1;
  save();
  if (lines.length && typeof talk === 'function') await talk(lines.map(l => [P.who, l]));
}
/* alpha 0.4: a game begun before Copperleaf: the lab and your room have moved, and you are told once */
function storyMovedCheck() {
  if (
    !S.started ||
    B ||
    U.modal ||
    U.title ||
    TALK.on ||
    (typeof CS !== 'undefined' && CS.on) ||
    (typeof STEST !== 'undefined' && STEST.on) ||
    U.bench
  )
    return;
  const F = storyFlags();
  if (F.copperleafNote) return;
  F.copperleafNote = 1;
  save();
  if (!PLACE.copperleaf) return;
  modal({
    title: 'Copperleaf Town',
    html: '<p>Professor Hazel has moved her lab to Copperleaf Town, the hamlet up Route 1 · Hedgerow Lane, north of Marigold Town. Your room went with her: it is in Granny Juniper’s cottage there now, among the beehives.</p><p class="note">Marigold Town keeps its shop and its clinic. Copperleaf has the swing.</p>',
    btns: [{ l: 'Good to know', c: 'dark', f: closeModal }],
  });
}

/* ================= v47: BLAKE'S FIRST BATTLE, AND WHAT COMES AFTER =================
   The opening ends with Blake wanting a battle (cutscene.js); it starts as soon as Sundown is back on screen. */
/* what Blake says when he runs in (the opening's scene, or the step-by-step intro's conversation before the battle) */
function blakeHello(l) {
  const T = TRAINERS.blake0 || {},
    who = T.who || 'chad',
    sp = SP[l + '0'],
    rv = RULES.start.rival && RULES.start.rival[l],
    rs = rv && SP[rv];
  return [
    [who, '[surprised] Professor! Professor! Did another one fall in?'],
    [
      who,
      '[happy] I’m Blake. Blake Sterling. My father is Sterling Sterling the Third. Sterling Capital? You’ve heard of it. Everyone’s heard of it.',
    ],
    ...(rs && sp ? [[who, `And I picked ${rs.name}. It beats ${sp.name}. No offence. Well, a little offence.`]] : []),
    ['gini', 'Blake. They fell out of the sky ten minutes ago.'],
    [who, '[angry] Then it’s a fair fight. Mine only knows Tackle so far. Come on, surface stray. Battle me!'],
  ];
}
/* this device has seen Blake's first battle through once: next time it can be skipped */
function openingDone() {
  try {
    return localStorage.getItem('nw-opening-done') === '1';
  } catch (e) {
    return false;
  }
}
function openingMark() {
  try {
    localStorage.setItem('nw-opening-done', '1');
  } catch (e) {}
}
function storyRivalBattle(o = {}) {
  const t0 = performance.now(),
    go = async () => {
      if (B || !S.started) return;
      U.modal = null;
      if (o.talkFirst && typeof talk === 'function' && !TALK.on) {
        STORY.rivalTalk = 1;
        try {
          await talk(blakeHello(S.starter));
        } finally {
          STORY.rivalTalk = 0;
        }
        if (B || !S.started) return;
      }
      startTrainer('blake0', { talked: true });
      if (!B) storyAfterRival(null, TRAINERS.blake0);
    };
  /* once Sundown is on screen and settled: drawn a few times, its pictures on the card (as when the game first opens) */
  let f0 = null;
  const poll = () => {
    if (B || !S.started) return;
    const on = typeof DIO !== 'undefined' && DIO.ready,
      gl = typeof DGL !== 'undefined' && DGL.on;
    if (on && gl && f0 == null) f0 = DGL.frames;
    const ready =
      typeof DIO === 'undefined' ||
      (on && (!gl || (DGL.frames >= (f0 ?? 0) + 8 && (typeof EGL === 'undefined' || !EGL.normQ || !EGL.normQ.length))));
    if ((ready && performance.now() - t0 > 900) || performance.now() - t0 > 9000) {
      go();
      return;
    }
    setTimeout(poll, 150);
  };
  setTimeout(poll, 150);
}
/* win or lose: Blake has his say and goes off to train, Hazel heals your team and points you down the road */
async function storyAfterRival(o, T) {
  const F = storyFlags();
  F.rival0 = o === 'win' ? 'win' : o === 'lose' ? 'lose' : 'skip';
  F.met_blake0 = 1;
  save();
  if (o) openingMark();
  T = T || TRAINERS.blake0 || {};
  const who = T.who || 'chad';
  const W = U.welcome;
  U.welcome = null;
  const lines = [];
  if (o === 'win')
    lines.push(
      [who, '[surprised] What? I lost to someone who fell out of the sky an hour ago?'],
      [who, '[angry] Mine only knows Tackle. That’s my excuse and I’m sticking to it.']
    );
  else if (o === 'lose')
    lines.push([who, '[happy] Ha! Told you. Mine beats yours.'], [who, 'Don’t feel bad. You only got here today.']);
  if (o) lines.push([who, 'I’m off to train on the golf course. Next time I’ll have a whole team. Try to keep up!']);
  if (lines.length && typeof talk === 'function') await talk(lines);
  healAll();
  save();
  const after = [
    [
      'gini',
      '[happy] There, good as new. Any time they’re hurt, the clinic in Marigold Town patches them up for free. It’s just down Hedgerow Lane.',
    ],
    ['gini', 'Granny Juniper has made up a room for you in her cottage, by the hives. A rest there does wonders.'],
    [
      'gini',
      'One more thing. When someone falls in, their things come down too, and they scatter along Tallgrass Meadow, past Marigold Town. If anything of yours made it, that’s where it’ll be.',
    ],
    ['gini', 'Now go and walk! Every step counts. Come back and see me any time.'],
  ];
  if (typeof talk === 'function') await talk(after);
  if (typeof loreFlags === 'function') loreFlags().askLongGrass = 1;
  save();
  if (W) modal(W);
  else if (typeof postProcess === 'function') postProcess();
}
/* v47 part 4: after the first win over a trainer with a story beat: a clue to who you were (Cass Flow, at the pressing
   plant), or the ending (Vinylla, at the Inner Sun): what everyone says, the last clue, and the B-side */
async function storyAfterWin(T) {
  if (!T) return;
  if (T.ending) {
    await storyEnding(T);
    return;
  }
  if (T.clue && typeof loreClue === 'function') loreClue(T.clue);
  else if (typeof postProcess === 'function') postProcess();
}
async function storyEnding(T) {
  const L = T.endLines || [];
  if (typeof music === 'function') music('title');
  if (L.length && typeof talk === 'function') await talk(L.map(l => [l[0], l[1]]));
  const E = ((typeof LORE === 'function' && LORE().story) || []).find(s => s.id === 'ending');
  if (typeof loreClue === 'function')
    loreClue('who'); /* the last clue: its flag, "ending", is the story's last stage */
  else {
    storyFlags().ending = 1;
  }
  if (E)
    modal({
      title: esc(E.title),
      cls: 'clue-sheet',
      html: `<p>${esc(E.text)}</p><p class="note">Thank you for playing Pocket Billies. Every place, trainer and Billie is still out there: the road goes on.</p>`,
      btns: [{ l: 'Keep walking', c: 'dark', f: closeModal }],
    });
  save();
}
