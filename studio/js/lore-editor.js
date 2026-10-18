'use strict';
/* ================= LORE & STORY (v47) =================
   The world and the story the game draws on (game data "lore", first written by tools/build-lore-v47.py): world
   entries, the story stage by stage, people, places, legends, the clues to who you were, books and papers in rooms,
   the loading screen's lines and what people say in each place at each stage of the story.
   "When it shows" (unlock): start · place:<stop id> · meet:<look id> · flag:<story flag> · badges:<number>.
   The stage of the story is the number of badges you have (9 after the ending). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { esc } from './game-stand-ins.js';
import {
  ACTS,
  SECTIONS,
  ask,
  card,
  changed,
  dialog,
  grid,
  numberField,
  peopleOptions,
  readPath,
  render,
  selectField,
  setReadPath,
  setWritePath,
  studioState,
  textField,
  uniqueKey,
  writePath,
} from './studio-app.js';
expose({
  LORE_TABS: [() => LORE_TABS],
  LORE_UNLOCK: [() => LORE_UNLOCK],
  loreDelBtn: [() => loreDelBtn],
  loreSceneOpts: [() => loreSceneOpts],
});
/* to-module: end */
const LORE_TABS = [
  ['world', 'World'],
  ['story', 'Story'],
  ['people', 'People'],
  ['places', 'Places'],
  ['legends', 'Legends'],
  ['clues', 'Clues'],
  ['books', 'Books'],
  ['loading', 'Loading screen'],
  ['chat', 'What people say'],
];
const LORE_UNLOCK =
  'start (from the beginning) · place:&lt;stop id&gt; (been there) · meet:&lt;look id&gt; (met them) · flag:&lt;story flag&gt; · badges:&lt;number&gt;';
/* a list of lines at a path, edited one per line */
{
  const g = readPath,
    st = writePath;
  setReadPath(function (path, o) {
    if (path && path.startsWith('@lines.')) {
      const v = g(path.slice(7));
      return Array.isArray(v) ? v.join('\n') : '';
    }
    return g(path, o);
  });
  setWritePath(function (path, v, o) {
    if (path && path.startsWith('@lines.')) {
      st(
        path.slice(7),
        String(v || '')
          .split('\n')
          .map(x => x.trim())
          .filter(Boolean)
      );
      return;
    }
    return st(path, v, o);
  });
}
const loreSceneOpts = () =>
  Object.keys(studioState.D.scenes || {})
    .filter(k => !studioState.D.scenes[k].test && !k.includes('@'))
    .sort()
    .map(k => [k, (studioState.D.scenes[k].name || k) + ' (' + k + ')']);
const loreDelBtn = (k, i) =>
  `<button class="btn sm danger subtle" data-act="loreDel" data-k="${k}" data-i="${esc(String(i))}">Delete</button>`;
SECTIONS.lore = () => {
  const D = studioState.D,
    L = (D.lore = D.lore || {}),
    tab = studioState.sel.ltab || 'world';
  const tabs = `<div class="seg-row lore-tabs">${LORE_TABS.map(([k, n]) => `<button class="btn sm ${k === tab ? 'primary' : ''}" data-act="loreTab" data-k="${k}">${n}</button>`).join('')}</div>`;
  const list = (key, fields, one) => {
    const A = Array.isArray(L[key]) ? L[key] : (L[key] = []);
    return (
      A.map((e, i) =>
        card(esc(e.title || e.id || `Entry ${i + 1}`), fields(`lore.${key}.${i}`, e, i), { acts: loreDelBtn(key, i) })
      ).join('') +
      `<div class="seg-row"><button class="btn" data-act="loreAdd" data-k="${key}">+ Add ${one}</button></div>`
    );
  };
  const keyed = (key, fields, one) => {
    const O = L[key] && !Array.isArray(L[key]) ? L[key] : (L[key] = {});
    return (
      Object.entries(O)
        .map(([k, e]) =>
          card(
            esc(e.title || e.name || k),
            `<small class="mono">${esc(k)}</small>` + fields(`lore.${key}.${k}`, e, k),
            { acts: loreDelBtn(key, k) }
          )
        )
        .join('') +
      `<div class="seg-row"><button class="btn" data-act="loreAdd" data-k="${key}">+ Add ${one}</button></div>`
    );
  };
  let body = '',
    sub = '';
  if (tab === 'world') {
    sub = 'What the Hollow Earth is, how it works, what Billies are. Shown on the Lore page of the Guide.';
    body = list(
      'world',
      p =>
        grid(
          textField('Title', p + '.title'),
          textField('Id', p + '.id'),
          textField('When it shows', p + '.unlock', { help: LORE_UNLOCK })
        ) + textField('Text', p + '.text', { area: 1, rows: 4 }),
      'a world entry'
    );
  }
  if (tab === 'story') {
    sub = 'The main thread, in order. Each part shows in the Guide once you have that many badges (its stage).';
    body = list(
      'story',
      p =>
        grid(
          textField('Title', p + '.title'),
          textField('Id', p + '.id'),
          numberField('Stage (badges)', p + '.stage', { min: 0, max: 9, step: 1 })
        ) + textField('Text', p + '.text', { area: 1, rows: 4 }),
      'a part of the story'
    );
  }
  if (tab === 'people') {
    sub = 'Who’s who: a look (from People), a role, what they want and how they talk.';
    body = keyed(
      'people',
      p =>
        grid(
          textField('Name', p + '.name'),
          selectField('Look', p + '.who', typeof peopleOptions === 'function' ? peopleOptions() : [], {
            none: 'No portrait',
            opt: 1,
          }),
          textField('Role', p + '.role'),
          textField('When it shows', p + '.unlock', { help: LORE_UNLOCK })
        ) +
        textField('About them', p + '.text', { area: 1, rows: 3 }) +
        textField('Their voice (a line or a description)', p + '.voice', { area: 1, rows: 2 }),
      'a person'
    );
  }
  if (tab === 'places') {
    sub = 'Each stop’s history, what it’s known for, its landmark and a local legend. Shown once you’ve been there.';
    const P = (L.places = L.places || {});
    body = (D.route || [])
      .filter(r => r.id)
      .map(r =>
        card(
          esc(r.name),
          textField('History', `lore.places.${r.id}.history`, { area: 1, rows: 2 }) +
            textField('Known for', `lore.places.${r.id}.known`, { area: 1, rows: 2 }) +
            textField('Landmark', `lore.places.${r.id}.landmark`, { area: 1, rows: 2 }) +
            textField('Local legend', `lore.places.${r.id}.legend`, { area: 1, rows: 2 }),
          { sub: P[r.id] ? '' : 'Nothing written yet.' }
        )
      )
      .join('');
  }
  if (tab === 'legends') {
    sub = 'Stories people tell, found as you go.';
    body = list(
      'legends',
      p =>
        grid(
          textField('Title', p + '.title'),
          textField('Id', p + '.id'),
          selectField(
            'Place',
            p + '.place',
            (D.route || []).filter(r => r.id).map(r => [r.id, r.name]),
            { none: 'Anywhere', opt: 1 }
          ),
          textField('When it shows', p + '.unlock', { help: LORE_UNLOCK })
        ) + textField('Text', p + '.text', { area: 1, rows: 3 }),
      'a legend'
    );
  }
  if (tab === 'clues') {
    sub =
      'The clues to who you were. A clue with a place lies there as a glint you walk over. When it shows is usually flag:<name>, and finding it sets that flag.';
    body = list(
      'clues',
      p =>
        grid(
          textField('Title', p + '.title'),
          textField('Id', p + '.id'),
          textField('When it shows', p + '.unlock', { help: LORE_UNLOCK }),
          selectField('Lies in', p + '.at.scene', loreSceneOpts(), { none: 'Nowhere (found in the story)', opt: 1 }),
          textField('Beside (props whose name matches)', p + '.at.near', {
            opt: 1,
            help: 'Part of a prop name, or several with |, like bush_berry|bramble',
          })
        ) + textField('Text', p + '.text', { area: 1, rows: 3 }),
      'a clue'
    );
  }
  if (tab === 'books') {
    sub =
      'Books and papers in rooms. Put one on any furniture in the Walk scenes editor: action “read”, and the book’s id.';
    const used = {};
    for (const [sid, sc] of Object.entries(D.scenes || {}))
      for (const pr of sc.props || [])
        if (pr.act === 'read' && pr.book) (used[pr.book] = used[pr.book] || []).push(sc.name || sid);
    body = keyed(
      'books',
      (p, e, k) =>
        grid(textField('Title', p + '.title'), textField('By', p + '.by')) +
        textField('Pages (one per line)', '@lines.' + p + '.pages', { area: 1, rows: 5 }) +
        `<p class="help">${used[k] ? 'In: ' + esc(used[k].join(', ')) : 'Not placed in any room yet.'}</p>`,
      'a book'
    );
  }
  if (tab === 'loading') {
    sub = 'Short lines from the world, shown on the loading screen a few at a time, in a random order.';
    body = card('Lines', textField('One per line', '@lines.lore.loading', { area: 1, rows: 14 }));
  }
  if (tab === 'chat') {
    sub =
      'What people say in each place, on top of the scene’s own chat. The lines for the latest stage you’ve reached are used (stage = badges, 9 after the ending).';
    const C = (L.chat = L.chat || {});
    body = (D.route || [])
      .filter(r => r.id)
      .map(r => {
        const st = Object.keys(C[r.id] || {}).sort((a, b) => a - b);
        return card(
          esc(r.name),
          st.map(s => textField(`From stage ${s}`, `@lines.lore.chat.${r.id}.${s}`, { area: 1, rows: 3 })).join('') +
            `<div class="seg-row"><button class="btn sm" data-act="loreChatAdd" data-k="${r.id}">+ Lines for a stage</button></div>`
        );
      })
      .join('');
  }
  return `<div class="ed-col solo"><div class="ed-head"><h2>Lore & story</h2></div>${tabs}<p class="help">${sub}</p>${body}</div>`;
};
ACTS.loreTab = d => {
  studioState.sel.ltab = d.k;
  render();
};
ACTS.loreAdd = async d => {
  const L = (studioState.D.lore = studioState.D.lore || {}),
    k = d.k;
  if (k === 'people' || k === 'books') {
    const O = (L[k] = L[k] || {}),
      id = uniqueKey(k === 'people' ? 'person' : 'book', x => !!O[x]);
    O[id] =
      k === 'people'
        ? { name: 'Someone new', role: '', unlock: 'start', text: '', voice: '' }
        : { title: 'A new book', by: '', pages: ['The first page.'] };
  } else {
    const A = (L[k] = L[k] || []),
      id = uniqueKey(k, x => A.some(e => e.id === x));
    A.push(
      k === 'story'
        ? { id, stage: 0, title: 'A new part', text: '' }
        : k === 'clues'
          ? { id, title: 'A new clue', unlock: 'flag:clue_' + id, text: '' }
          : { id, title: 'A new entry', unlock: 'start', text: '' }
    );
  }
  changed();
  render();
};
ACTS.loreDel = async d => {
  if (
    !(await ask('Delete this entry? Anything that names it (a room’s book, a story flag) stops finding it.', 'Delete'))
  )
    return;
  const L = studioState.D.lore,
    O = L[d.k];
  if (Array.isArray(O)) O.splice(+d.i, 1);
  else if (O) delete O[d.i];
  changed();
  render();
};
ACTS.loreChatAdd = async d => {
  const v = await dialog(
    'Lines for a stage',
    `<label class="fld"><span>From stage (badges, 0–9)</span><input type="number" id="loreStage" min="0" max="9" step="1" value="0"></label>`,
    [
      { l: 'Cancel', v: null },
      { l: 'Add', c: 'primary', f: m => +m.querySelector('#loreStage').value },
    ]
  );
  if (v == null || !Number.isFinite(v)) return;
  const C = (studioState.D.lore.chat = studioState.D.lore.chat || {}),
    P = (C[d.k] = C[d.k] || {}),
    s = String(Math.max(0, Math.min(9, Math.round(v))));
  if (!P[s]) P[s] = ['Something people say here.'];
  changed();
  render();
};
