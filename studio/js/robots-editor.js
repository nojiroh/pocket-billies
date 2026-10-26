'use strict';
/* ================= POCKET BILLIES STUDIO · Robots (phase 17) =================
   robots.json: robot parts (torsos with heads, arms that fit either side, legs) and gems, with their stats, types,
   weights, moves and pictures; and rules.json "robots", the numbers behind them. "Try a build" puts any gem and parts
   together and shows the robot as the game draws it (game/js/robot-art.js) with its types, weight, stats and moves,
   worked out by the game's own arithmetic (game/js/logic/robot-math.js). Trainers' robots are picked in Trainers. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import {
  robotMathAttack,
  robotMathBase,
  robotMathMoves,
  robotMathSpeed,
  robotMathTypes,
  robotMathWeight,
} from '../../game/js/logic/robot-math.js';
import { robotHeadId } from '../../game/js/logic/robot-joints.js';
import { artURL } from '../../game/js/art.js';
import { RIG_BACK_VIEW, drawRig, rigFrame, robotRigParts, setRobotRigData } from '../../game/js/skeleton-rig.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  card,
  changed,
  clone,
  colorField,
  grid,
  numberField,
  openSection,
  render,
  sectionShown,
  selectField,
  studioState,
  textField,
  typeChipHTML,
  typeOptions,
  uniqueKey,
} from './studio-app.js';
import { workbench } from './workbench.js';
import { wbPart } from './workbench-part.js';
/* eslint-disable no-func-assign */
expose({
  RB_KINDS: [() => RB_KINDS],
  RB_SHAPES: [() => RB_SHAPES],
  RB_SLOT_NAMES: [() => RB_SLOT_NAMES],
  RB_SLOT_OF: [() => RB_SLOT_OF],
  rbAnim: [() => rbAnim],
  rbAnimStart: [() => rbAnimStart, v => (rbAnimStart = v)],
  rbAnimate: [() => rbAnimate, v => (rbAnimate = v)],
  rbBuild: [() => rbBuild, v => (rbBuild = v)],
  rbCanvasHTML: [() => rbCanvasHTML],
  rbData: [() => rbData],
  rbFit: [() => rbFit],
  rbGemEditorHTML: [() => rbGemEditorHTML, v => (rbGemEditorHTML = v)],
  rbJointsHTML: [() => rbJointsHTML, v => (rbJointsHTML = v)],
  rbList: [() => rbList],
  rbListHTML: [() => rbListHTML, v => (rbListHTML = v)],
  rbPartEditorHTML: [() => rbPartEditorHTML, v => (rbPartEditorHTML = v)],
  rbPct: [() => rbPct],
  rbReadoutHTML: [() => rbReadoutHTML, v => (rbReadoutHTML = v)],
  rbRulesHTML: [() => rbRulesHTML, v => (rbRulesHTML = v)],
  rbSel: [() => rbSel],
  rbSp: [() => rbSp],
  rbStatsHTML: [() => rbStatsHTML, v => (rbStatsHTML = v)],
  rbThumbHTML: [() => rbThumbHTML, v => (rbThumbHTML = v)],
  rbTryHTML: [() => rbTryHTML, v => (rbTryHTML = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const RB_KINDS = [
  ['torso', 'Torsos'],
  ['arm', 'Arms'],
  ['legs', 'Legs'],
  ['gem', 'Gems'],
  ['rules', 'Rules'],
];
const RB_SHAPES = {
  torso: [
    ['block', 'Block'],
    ['barrel', 'Barrel'],
    ['slim', 'Slim'],
  ],
  arm: [
    ['fist', 'Fist'],
    ['drill', 'Drill'],
    ['claw', 'Claw'],
    ['cannon', 'Cannon'],
    ['coil', 'Coil'],
  ],
  legs: [
    ['legs', 'Two legs'],
    ['treads', 'Treads'],
    ['hover', 'Hover skirt'],
  ],
};
const RB_SLOT_OF = { torso: 'torso', armL: 'arm', armR: 'arm', legs: 'legs' };
const RB_SLOT_NAMES = { torso: 'Torso', armL: 'Left arm', armR: 'Right arm', legs: 'Legs', gem: 'Gem' };
const rbData = () => {
  const D = studioState.D;
  if (!D.robots) D.robots = { parts: {}, gems: {} };
  return D.robots;
};
const rbSel = () => {
  const s = studioState.sel;
  if (!s.rbKind) s.rbKind = 'torso';
  if (!s.rbBuild) s.rbBuild = {};
  return s;
};
/** the parts of one kind, as [id, part] */
const rbList = kind =>
  kind === 'gem' ? Object.entries(rbData().gems) : Object.entries(rbData().parts).filter(([, P]) => P.slot === kind);
/** the build being tried, every slot filled with something that fits (or null when the data has none) */
function rbBuild() {
  const S = rbSel(),
    B = S.rbBuild,
    R = rbData();
  for (const k of ['torso', 'armL', 'armR', 'legs']) {
    const P = R.parts[B[k]];
    if (!P || P.slot !== RB_SLOT_OF[k])
      B[k] = (rbList(RB_SLOT_OF[k])[k === 'armR' ? 1 : 0] || rbList(RB_SLOT_OF[k])[0] || [])[0];
  }
  if (!R.gems[B.gem]) B.gem = (rbList('gem')[0] || [])[0];
  return ['torso', 'armL', 'armR', 'legs', 'gem'].every(k => B[k]) ? B : null;
}
const rbFit = B => Object.fromEntries(['torso', 'armL', 'armR', 'legs'].map(k => [k, { id: B[k], up: 0 }]));
const rbSp = B => `bot:${B.gem}.${B.torso}.${B.armL}.${B.armR}.${B.legs}`;
const rbPct = f => `${f >= 1 ? '+' : '−'}${Math.abs(Math.round((f - 1) * 100))}%`;
/** a canvas the animator below draws a robot on */
const rbCanvasHTML = (sp, view, size) =>
  `<canvas class="rb-cv" data-bot="${escapeHtml(sp)}" data-v="${view}" width="96" height="96" style="width:${size}px;height:${size}px"></canvas>`;
/** the build's types, weight, stats and moves, with the game's arithmetic */
function rbReadoutHTML(B) {
  const D = studioState.D,
    R = rbData(),
    RR = D.rules.robots;
  if (!RR) return '<p class="help">rules.json has no "robots" yet.</p>';
  const fit = rbFit(B),
    ids = (D.stats || []).map(s => s.id),
    base = robotMathBase(R, RR, ids, B.gem, fit),
    w = robotMathWeight(R, fit),
    carry = R.parts[B.legs].carry || 100,
    types = robotMathTypes(R, fit),
    moves = robotMathMoves(R, D.moves, B.gem, fit);
  const G = R.gems[B.gem],
    T = R.parts[B.torso];
  return `<div class="parts-read"><p><b>${escapeHtml(`${G.short || G.name} ${T.short || T.name}`)}</b> · ${types.map(typeChipHTML).join(' ')}</p>
  <p>${w} kg on legs that carry ${carry} kg · Speed <b>${rbPct(robotMathSpeed(R, RR, fit))}</b> · Attack and Sp. Atk <b>${rbPct(robotMathAttack(R, RR, fit))}</b></p>
  <div class="rb-stats">${ids.map((k, i) => `<span><small>${escapeHtml((D.stats.find(s => s.id === k) || { name: k }).name)}</small><b>${base[i]}</b></span>`).join('')}<span><small>Total</small><b>${base.reduce((a, b) => a + b, 0)}</b></span></div>
  <p class="help">Base stats, like a species’ (the level works on them the same way). Moves: ${moves.map(m => escapeHtml((D.moves[m] || { n: m }).n)).join(', ') || 'none'}.</p></div>`;
}
function rbTryHTML() {
  const B = rbBuild();
  if (!B) return card('Try a build', '<p class="help">Add at least one torso, arm, legs and gem first.</p>');
  const sel = k => {
    const kind = k === 'gem' ? 'gem' : RB_SLOT_OF[k];
    return `<label class="fld"><span>${RB_SLOT_NAMES[k]}</span><select data-rbslot="${k}">${rbList(kind)
      .map(
        ([id, P]) => `<option value="${escapeHtml(id)}" ${B[k] === id ? 'selected' : ''}>${escapeHtml(P.name)}</option>`
      )
      .join('')}</select></label>`;
  };
  return card(
    'Try a build',
    `${grid(...['gem', 'torso', 'armL', 'armR', 'legs'].map(sel))}<div class="rb-prev">${rbCanvasHTML(rbSp(B), 'front', 192)}${rbCanvasHTML(rbSp(B), 'back', 192)}</div><div id="rbRead">${rbReadoutHTML(B)}</div>`,
    { sub: 'Any gem with any parts, drawn as the game draws it. Any arm fits either side.' }
  );
}
/** a part's (or gem's) picture as an <img>, or a colour swatch when it has none */
function rbThumbHTML(P, gem) {
  const path = gem ? P.img : P.art && P.art.img,
    col = gem ? P.color : P.art && P.art.color;
  return path
    ? `<img class="rb-th" src="${escapeHtml(artURL(path))}" alt="">`
    : `<span class="rb-th" style="background:${escapeHtml(col || '#888')}"></span>`;
}
function rbListHTML(kind) {
  const S = rbSel();
  if (kind === 'rules')
    return '<p class="help">The numbers behind every robot: part HP, breaking, weight, upgrades.</p>';
  return (
    rbList(kind)
      .map(
        ([id, P]) =>
          `<button class="lcard ${S.rbId === id ? 'on' : ''}" data-act="rbPick" data-id="${escapeHtml(id)}">${rbThumbHTML(P, kind === 'gem')}<span class="lt"><b>${escapeHtml(P.name)}</b><small class="mono">${escapeHtml(id)}</small><span class="row">${typeChipHTML(P.type)}</span></span></button>`
      )
      .join('') || '<p class="help">None yet.</p>'
  );
}
function rbStatsHTML(p) {
  const D = studioState.D;
  return `<div class="grid">${(D.stats || [])
    .map(s => numberField(s.name, `${p}.stats.${s.id}`, { opt: 1, min: 0, max: 150, step: 5 }))
    .join('')}</div>`;
}
function rbPartEditorHTML(id) {
  const D = studioState.D,
    P = rbData().parts[id],
    p = `robots.parts.${id}`,
    kind = P.slot,
    moves = Object.entries(D.moves).map(([k, M]) => [k, `${M.n} (${M.t === 'None' ? 'Normal' : M.t})`]),
    users = Object.values(D.trainers || {}).filter(T =>
      (T.team || []).some(e => e.robot && Object.values(e.robot).includes(id))
    );
  const pics = [
    ['img', 'Front picture'],
    ['imgB', 'Back picture'],
    ...(kind === 'torso'
      ? [
          ['head', 'Head, front'],
          ['headB', 'Head, back'],
        ]
      : []),
  ];
  return `${card(
    'Basics',
    grid(
      textField('Name', `${p}.name`, { max: 28 }),
      kind === 'torso'
        ? textField('Family name', `${p}.short`, { max: 14, help: 'In a robot’s name: Volt + Vane.' })
        : '',
      selectField('Type', `${p}.type`, typeOptions(), {
        rr: 1,
        help: kind === 'arm' ? 'Its move is usually this type.' : 'One of the robot’s two types.',
      }),
      kind === 'torso' ? '' : selectField('Gives the move', `${p}.move`, moves, { rr: 1 }),
      numberField('Weight', `${p}.wt`, { unit: 'kg', min: 0, max: 300, step: 1 }),
      numberField('Toughness', `${p}.dur`, {
        opt: 1,
        min: 0.2,
        max: 3,
        step: 0.1,
        help: 'Its own HP × this (1 = normal).',
      }),
      kind === 'legs'
        ? numberField('Carries', `${p}.carry`, {
            unit: 'kg',
            min: 10,
            max: 500,
            step: 5,
            help: 'Over this the robot slows down.',
          })
        : ''
    ) + textField('Description', `${p}.d`, { area: 1, rows: 2 })
  )}
  ${card('Stats', rbStatsHTML(p), { sub: 'Added to every robot stat floor (Rules). Upgrades add a share of these.' })}
  ${card(
    'Picture',
    `${grid(...pics.map(([k, l]) => textField(l, `${p}.art.${k}`, { opt: 1, help: k === 'img' ? 'A path in game/art, like robots/vane.png. Upload pictures in the Art browser.' : '' })))}
    <div class="rb-pics">${pics
      .map(([k, l]) =>
        P.art[k]
          ? `<figure><img class="rb-pic" src="${escapeHtml(artURL(P.art[k]))}" alt=""><figcaption>${escapeHtml(l)}</figcaption></figure>`
          : ''
      )
      .join('')}</div>
    ${rbJointsHTML(id, P)}
    <p class="help">Without a picture the game draws a stand-in from these:</p>${grid(
      colorField('Colour', `${p}.art.color`),
      selectField('Shape', `${p}.art.shape`, RB_SHAPES[kind] || [], { rr: 1 }),
      numberField('Width', `${p}.art.w`, { opt: 1, unit: 'px', min: 4, max: 48, step: 1 }),
      numberField('Height', `${p}.art.h`, { opt: 1, unit: 'px', min: 4, max: 48, step: 1 })
    )}`
  )}
  ${users.length ? `<p class="help">Used by ${users.map(T => escapeHtml(T.name)).join(', ')}.</p>` : ''}`;
}
/* studio track ST-5: where the part's pictures join (stored or worked out), and the way to the workbench */
function rbJointsHTML(id, P) {
  const said = J => {
    const v = ['front', 'back'].filter(k => J?.[k]);
    return v.length ? `stored (${v.join(', ')})` : 'worked out from the picture';
  };
  const btn = (kitId, label) =>
    `<button class="btn sm" data-act="rbJoints" data-id="${escapeHtml(kitId)}">${label}</button>`;
  if (!P.art.img && !P.art.imgB) return '';
  return `<div class="seg-row rb-joints"><span class="help">Joints: ${said(P.art.joints)}${P.slot === 'torso' && (P.art.head || P.art.headB) ? `; head: ${said(P.art.headJoints)}` : ''}.</span>${btn(id, 'Edit joints on the workbench')}${P.slot === 'torso' && (P.art.head || P.art.headB) ? btn(robotHeadId(id), 'The head’s joints') : ''}</div>`;
}
/* opens the workbench's Part mode on a robot part, in the pane the Robots section is in */
ACTIONS.rbJoints = d => {
  Object.assign(wbPart, { src: 'robots', id: d.id, kit: '', kind: '', size: 'M', sel: null, tool: 'part' });
  wbPart.zoom = { front: 0, back: 0 };
  wbPart.fit = { other: '', socket: '', angle: 0, swing: false };
  workbench.mode = 'part';
  if (studioState.sec2 === 'robots') ACTIONS.openBeside({ s: 'workbench' });
  else openSection('workbench');
};
function rbGemEditorHTML(id) {
  const D = studioState.D,
    p = `robots.gems.${id}`,
    G = rbData().gems[id],
    moves = Object.entries(D.moves).map(([k, M]) => [k, `${M.n} (${M.t === 'None' ? 'Normal' : M.t})`]);
  return `${card(
    'Basics',
    grid(
      textField('Name', `${p}.name`, { max: 28 }),
      textField('Short name', `${p}.short`, { max: 14, help: 'In a robot’s name: Volt + Vane.' }),
      selectField('Type', `${p}.type`, typeOptions(), {
        rr: 1,
        help: `Its robot’s moves of this type hit ×${(studioState.D.rules.robots || {}).gemAffinity || 1.2}.`,
      }),
      selectField('Signature move', `${p}.move`, moves, { rr: 1 }),
      colorField('Colour', `${p}.color`),
      textField('Picture', `${p}.img`, { opt: 1, help: 'Drawn in the torso’s chest socket. A path in game/art.' })
    ) + textField('Description', `${p}.d`, { area: 1, rows: 2 })
  )}
  ${G.img ? `<div class="rb-pics"><figure><img class="rb-pic" src="${escapeHtml(artURL(G.img))}" alt=""><figcaption>Picture</figcaption></figure></div>` : ''}
  ${card('Stats', rbStatsHTML(p), { sub: 'Added to the robot’s stats. The gem is the robot: its level and XP stay with it.' })}`;
}
function rbRulesHTML() {
  const p = 'rules.robots',
    RR = studioState.D.rules.robots;
  if (!RR) return card('Rules', '<p class="help">rules.json has no "robots" yet.</p>');
  return `${card(
    'Stats',
    grid(
      numberField('Stat floor', `${p}.baseStat`, {
        min: 0,
        max: 100,
        step: 1,
        help: 'Added to every stat before the parts.',
      }),
      numberField('Per upgrade', `${p}.upgradeStat`, {
        min: 0,
        max: 1,
        step: 0.01,
        help: 'Each upgrade adds this share of a part’s stats.',
      }),
      numberField('Most upgrades', `${p}.maxUpgrade`, { min: 0, max: 10, step: 1 }),
      numberField('Gem type bonus', `${p}.gemAffinity`, {
        min: 1,
        max: 2,
        step: 0.05,
        unit: '×',
        help: 'A move of the gem’s type hits this much harder.',
      }),
      numberField('XP for beating one', `${p}.xpYield`, { min: 1, max: 500, step: 5, help: 'Like a species’ yield.' })
    )
  )}
  ${card(
    'Weight',
    grid(
      numberField('Overweight slows', `${p}.overweightExp`, {
        min: 0,
        max: 3,
        step: 0.05,
        help: 'Over the legs’ carry: Speed × (carry ÷ weight) to this power.',
      }),
      numberField('Light is faster', `${p}.lightBonus`, {
        min: 0,
        max: 1,
        step: 0.01,
        help: 'Up to this much faster with nothing on the legs.',
      }),
      numberField('Normal weight', `${p}.refWeight`, { unit: 'kg', min: 1, max: 500, step: 5 }),
      numberField('Attack follows weight', `${p}.attackExp`, {
        min: 0,
        max: 2,
        step: 0.05,
        help: 'Attack and Sp. Atk × (weight ÷ normal weight) to this power.',
      }),
      numberField('Most it can change', `${p}.cap`, { min: 0, max: 1, step: 0.01 })
    )
  )}
  ${card(
    'Parts in battle',
    grid(
      numberField('Part HP', `${p}.partHpRatio`, {
        min: 0.05,
        max: 2,
        step: 0.05,
        help: 'A limb’s HP as a share of the robot’s max HP (× its toughness).',
      }),
      numberField('Part damage', `${p}.partShare`, {
        min: 0,
        max: 3,
        step: 0.05,
        help: 'A limb loses the hit’s damage × this.',
      }),
      numberField('Broken legs: Speed ×', `${p}.legBreakSpeed`, { min: 0, max: 1, step: 0.05 }),
      ...['torso', 'armL', 'armR', 'legs'].map(k =>
        numberField(`Hits land on: ${RB_SLOT_NAMES[k].toLowerCase()}`, `${p}.hitWeights.${k}`, {
          min: 0,
          max: 1,
          step: 0.05,
          help: k === 'torso' ? 'The torso is the body only: no part damage.' : '',
        })
      )
    ),
    {
      sub: 'A hit on a robot also lands on a part, by these chances (aimed moves pick one). A broken arm loses its move; broken legs are slow.',
    }
  )}`;
}
SECTIONS.robots = () => {
  const S = rbSel(),
    R = rbData(),
    kind = S.rbKind;
  setRobotRigData(R);
  afterRender(rbAnimStart);
  const list = rbList(kind);
  if (kind !== 'rules' && !list.some(([id]) => id === S.rbId)) S.rbId = (list[0] || [])[0];
  const id = S.rbId,
    item = kind === 'gem' ? R.gems[id] : R.parts[id];
  const tabs = `<div class="seg">${RB_KINDS.map(([k, n]) => `<button class="btn sm ${k === kind ? 'primary' : ''}" data-act="rbKind" data-k="${k}">${n}</button>`).join('')}</div>`;
  const head =
    kind === 'rules'
      ? `<div class="ed-head"><div><small class="mono">rules.json → robots</small><h2>Robot rules</h2></div></div>`
      : item
        ? `<div class="ed-head"><div><small class="mono">robots.json → ${kind === 'gem' ? 'gems' : 'parts'} → ${escapeHtml(id)}</small><h2>${escapeHtml(item.name)}</h2></div><div class="seg-row"><button class="btn subtle" data-act="rbDup">Duplicate</button><button class="btn danger" data-act="rbDel">Delete</button></div></div>`
        : '';
  const body =
    kind === 'rules' ? rbRulesHTML() : !item ? '' : kind === 'gem' ? rbGemEditorHTML(id) : rbPartEditorHTML(id);
  return `<div class="split"><aside class="list-col"><div class="list-head">${tabs}${kind === 'rules' ? '' : `<button class="btn primary" data-act="rbNew">+ New ${kind === 'gem' ? 'gem' : kind === 'arm' ? 'arm' : kind}</button>`}</div><div class="llist">${rbListHTML(kind)}</div></aside>
  <div class="ed-col rb-ed">${head}${rbTryHTML()}${body}</div></div>`;
};
/* after an edit: the robots are drawn again and the readout follows */
studioState.hooks.robots = () => {
  setRobotRigData(rbData());
  const B = rbBuild(),
    r = document.getElementById('rbRead');
  if (B && r) r.innerHTML = rbReadoutHTML(B);
  document.querySelectorAll('.rb-cv').forEach(c => B && (c.dataset.bot = rbSp(B)));
};
/* the robots on this page, in their idle pose, at the game's own frame steps */
const rbAnim = { on: false };
function rbAnimStart() {
  if (!sectionShown('robots') || rbAnim.on) return;
  rbAnim.on = true;
  requestAnimationFrame(rbAnimate);
}
function rbAnimate(ts) {
  const cvs = document.querySelectorAll('.pane .rb-cv');
  if (!cvs.length) {
    rbAnim.on = false;
    return;
  }
  for (const c of cvs) {
    const view = c.dataset.v,
      R = robotRigParts(c.dataset.bot, view === 'back' ? RIG_BACK_VIEW : 1),
      x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    if (R) drawRig(x, R, rigFrame(R, null, 0, Math.floor(ts / 50) * 50, 1), view);
  }
  requestAnimationFrame(rbAnimate);
}

document.addEventListener('change', ev => {
  const k = ev.target && ev.target.dataset && ev.target.dataset.rbslot;
  if (!k) return;
  rbSel().rbBuild[k] = ev.target.value;
  render();
});
ACTIONS.rbKind = d => {
  rbSel().rbKind = d.k;
  render();
};
ACTIONS.rbPick = d => {
  const S = rbSel();
  S.rbId = d.id;
  /* try the picked part in the build */
  if (S.rbKind === 'gem') S.rbBuild.gem = d.id;
  else if (S.rbKind === 'arm') S.rbBuild.armL = d.id;
  else S.rbBuild[S.rbKind] = d.id;
  render();
};
ACTIONS.rbNew = () => {
  const S = rbSel(),
    R = rbData(),
    kind = S.rbKind,
    taken = k => !!(R.parts[k] || R.gems[k]),
    k = uniqueKey('new' + kind, taken);
  if (kind === 'gem')
    R.gems[k] = {
      name: 'New Gem',
      short: 'New',
      type: 'Fire',
      move: Object.keys(studioState.D.moves)[0],
      stats: {},
      color: '#FFFFFF',
      d: '',
    };
  else
    R.parts[k] = {
      name: 'New ' + (kind === 'arm' ? 'Arm' : kind === 'legs' ? 'Legs' : 'Frame'),
      ...(kind === 'torso' ? { short: 'New' } : {}),
      slot: kind,
      type: 'Steel',
      rar: 'common',
      wt: kind === 'torso' ? 40 : kind === 'legs' ? 20 : 12,
      dur: 1,
      ...(kind === 'legs' ? { carry: 100 } : {}),
      ...(kind === 'torso' ? {} : { move: Object.keys(studioState.D.moves)[0] }),
      stats: {},
      art: { color: '#9AA3AE', shape: RB_SHAPES[kind][0][0] },
      d: '',
    };
  S.rbId = k;
  changed();
  render();
};
ACTIONS.rbDup = () => {
  const S = rbSel(),
    R = rbData(),
    gem = S.rbKind === 'gem',
    src = gem ? R.gems[S.rbId] : R.parts[S.rbId];
  if (!src) return;
  const k = uniqueKey(S.rbId, x => !!(R.parts[x] || R.gems[x])),
    c = clone(src);
  c.name += ' copy';
  (gem ? R.gems : R.parts)[k] = c;
  S.rbId = k;
  changed();
  render();
};
ACTIONS.rbDel = async () => {
  const S = rbSel(),
    R = rbData(),
    gem = S.rbKind === 'gem',
    id = S.rbId,
    P = gem ? R.gems[id] : R.parts[id];
  if (!P) return;
  const users = Object.values(studioState.D.trainers || {}).filter(T =>
    (T.team || []).some(e => e.robot && Object.values(e.robot).includes(id))
  );
  if (
    !(await ask(
      `Delete ${escapeHtml(P.name)}?${users.length ? ` ${users.map(T => escapeHtml(T.name)).join(', ')} use${users.length === 1 ? 's' : ''} it; their robot${users.length === 1 ? '' : 's'} using it ${users.length === 1 ? 'is' : 'are'} removed from the team.` : ''} Robots players built with it lose it when they load.`,
      'Delete'
    ))
  )
    return;
  delete (gem ? R.gems : R.parts)[id];
  for (const T of users) T.team = T.team.filter(e => !(e.robot && Object.values(e.robot).includes(id)));
  S.rbId = null;
  changed();
  render();
};
