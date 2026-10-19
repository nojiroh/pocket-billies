'use strict';
/* ================= POCKET BILLIES STUDIO · story scripts (Project Story S3) =================
   The script field every script is edited in (a trainer's, a person's in a scene, story.json's): the errors as you
   type, with their line, from the game's own parser and the same story checks check-data runs
   (game/js/logic/story-checks.js); line ids; a command reference built from the parser's tables. The condition
   field (when, unless, requires) checks the same way. The Story section edits story.json's scripts and shows its
   flags, start presets and quests. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { conditionProblem } from '../../game/js/logic/conditions.js';
import { scriptProblem, scriptReference } from '../../game/js/logic/script-parse.js';
import { giveLineIds, scriptsOf, storyFindings } from '../../game/js/logic/story-checks.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  card,
  changed,
  commit,
  dialog,
  grid,
  readPath,
  render,
  selectField,
  setReadPath,
  setWritePath,
  studioState,
  textField,
  toast,
  writePath,
} from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  OPENS_BLOCK: [() => OPENS_BLOCK],
  caretRow: [() => caretRow],
  conditionField: [() => conditionField, v => (conditionField = v)],
  conditionMessageHTML: [() => conditionMessageHTML, v => (conditionMessageHTML = v)],
  giveStudioLineIds: [() => giveStudioLineIds, v => (giveStudioLineIds = v)],
  lineIdHash: [() => lineIdHash, v => (lineIdHash = v)],
  scriptField: [() => scriptField, v => (scriptField = v)],
  scriptLinesOf: [() => scriptLinesOf],
  scriptMessages: [() => scriptMessages, v => (scriptMessages = v)],
  scriptMessagesHTML: [() => scriptMessagesHTML, v => (scriptMessagesHTML = v)],
  scriptOwner: [() => scriptOwner, v => (scriptOwner = v)],
  showCaretRow: [() => showCaretRow],
  storyFieldTimer: [() => storyFieldTimer, v => (storyFieldTimer = v)],
  storyFindingPlace: [() => storyFindingPlace, v => (storyFindingPlace = v)],
  storyFindingsNow: [() => storyFindingsNow],
  storyFound: [() => storyFound, v => (storyFound = v)],
  storyFoundAt: [() => storyFoundAt, v => (storyFoundAt = v)],
  storyKeyOk: [() => storyKeyOk],
  storyLastBox: [() => storyLastBox, v => (storyLastBox = v)],
  storyShowLine: [() => storyShowLine],
  storyTabFree: [() => storyTabFree, v => (storyTabFree = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* ---------- where a script lives ---------- */
/* a script's id, as the checks name it: trainer:<key>, person:<id> (in a scene's people), story:<key> */
function scriptOwner(id, D = studioState.D) {
  const [kind, k] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
  if (kind === 'trainer') return (D.trainers || {})[k] || null;
  if (kind === 'story') return ((D.story || {}).scripts || {})[k] || null;
  if (kind === 'person')
    for (const M of Object.values(D.maps || {})) for (const P of M.people || []) if (P.id === k) return P;
  return null;
}
/* the field's path is @script.<id>: one text, a line each, the indent kept (two spaces per level); blank lines go */
{
  const g = readPath,
    st = writePath;
  setReadPath(function (path, o) {
    if (path && path.startsWith('@script.')) {
      const O = scriptOwner(path.slice(8));
      return O && O.script ? O.script.join('\n') : '';
    }
    return g(path, o);
  });
  setWritePath(function (path, v, o) {
    if (path && path.startsWith('@script.')) {
      const O = scriptOwner(path.slice(8));
      if (!O) return;
      const L = scriptLinesOf(v);
      if (L.length) O.script = L;
      else delete O.script;
      return;
    }
    return st(path, v, o);
  });
}
const scriptLinesOf = text =>
  String(text || '')
    .split('\n')
    .map(x => x.trimEnd())
    .filter(x => x.trim());

/** where the Check's "Show me" takes a story finding: [section, selection]; a script's line is selected there */
export function storyFindingPlace(f, D = studioState.D) {
  const [kind, k] = (f.script || f.thing || ':').split(/:(.*)/);
  const at = f.script ? { storyAt: { script: f.script, line: f.line || 0 } } : {};
  const mapOf = id =>
    Object.keys(D.maps || {}).find(m => (D.maps[m].people || []).some(P => P.id === id)) ||
    ((/^maps\/(.+)\.json$/.exec(f.file || '') || [])[1] ?? null);
  if (kind === 'trainer') return ['trainers', { trainer: k, ...at }];
  if (kind === 'story') return ['story', { story: k, ...at }];
  if (kind === 'person' || kind === 'prop')
    return ['scenes', { scene: kind === 'person' ? mapOf(k) : mapOf(''), ...at }];
  if (kind === 'place')
    return [
      'world',
      {
        wtab: 'route',
        stop: Math.max(
          0,
          D.locations.findIndex(l => l.id === k)
        ),
      },
    ];
  return ['story', {}];
}
/* after "Show me": the script's line selected */
const storyShowLine = () => {
  const A = studioState.sel.storyAt;
  if (!A) return;
  studioState.sel.storyAt = null;
  const ta = document.querySelector(`textarea[data-script="${CSS.escape(A.script)}"]`);
  if (!ta) return;
  ta.scrollIntoView({ block: 'center' });
  const b = ta.closest('.scriptf').querySelector('[data-act="sfLine"]');
  ACTIONS.sfLine({ row: String(A.line) }, b || ta);
};

/* ---------- the field ---------- */
/** a script's text box with its errors under it; o: { rows, help } */
export function scriptField(label, id, o = {}) {
  if (studioState.sel.storyAt && studioState.sel.storyAt.script === id) afterRender(storyShowLine);
  return `<div class="fld wide scriptf" data-sf="${escapeHtml(id)}"><label><span>${label}</span><textarea data-p="@script.${escapeHtml(id)}" data-k="text" data-script="${escapeHtml(id)}" rows="${o.rows || 8}" spellcheck="false" class="mono">${escapeHtml(readPath('@script.' + id))}</textarea></label><div class="sf-bar"><small class="sf-at" aria-live="off">Line 1</small><button class="btn sm" data-act="sfIds" title="Give each new line of dialogue and option a line id (#l:…), as npm run story:ids does">Add line ids</button><button class="btn sm" data-act="sfRef" aria-expanded="false" title="Every command, block, slot and condition">Commands</button></div><ul class="sf-msgs" aria-live="polite">${scriptMessagesHTML(id)}</ul>${o.help ? `<small class="help">${o.help}</small>` : `<small class="help">Tab indents by two spaces (Shift+Tab back); press Esc first to leave the box with Tab. docs/SCRIPTS.md has the format.</small>`}</div>`;
}
/** a condition's text field (when, unless, requires) checked as you type; thing and field name it for the checks */
export function conditionField(label, p, thing, field, o = {}) {
  return `<div class="fld condf ${o.cls || ''}" data-cf="${escapeHtml(thing)}|${escapeHtml(field)}"><label><span>${label}</span><input type="text" data-p="${p}" data-k="text" data-opt="1" data-cond="1" class="mono" value="${escapeHtml(readPath(p) ?? '')}" placeholder="${escapeHtml(o.ph || '')}" spellcheck="false"></label><small class="sf-msgs cf-msg" aria-live="polite">${conditionMessageHTML(readPath(p), thing, field)}</small>${o.help ? `<small class="help">${o.help}</small>` : ''}</div>`;
}

/* the checks on the whole data, as check-data runs them: once for all the fields a page draws, again after a change
   (typing clears it; anything else, an undo or a rename, is a new page a moment later) */
let storyFound = null,
  storyFoundAt = 0;
const storyFindingsNow = () => {
  if (!storyFound || performance.now() - storyFoundAt > 300) {
    storyFound = storyFindings(studioState.D);
    storyFoundAt = performance.now();
  }
  return storyFound;
};
/** what to say under a script: the parser's error at once, else the checks' findings for it; line numbers are the
 * text box's rows (a blank row in the box isn't a line of the script) @param {string} text the box's text */
function scriptMessages(id, text) {
  const rows = String(text ?? readPath('@script.' + id) ?? '').split('\n'),
    at = rows.map((r, i) => [r, i]).filter(([r]) => r.trim()),
    row = line => (at[line] ? at[line][1] : 0),
    lines = at.map(([r]) => r.trimEnd()),
    p = scriptProblem(lines);
  if (p) return [{ level: 'problem', row: row(p.line || 0), message: p.message }];
  return storyFindingsNow()
    .filter(f => f.script === id)
    .map(f => ({ level: f.level, row: row(f.line || 0), message: f.message }));
}
function scriptMessagesHTML(id, text) {
  const M = scriptMessages(id, text);
  return M.length
    ? M.map(
        m =>
          `<li class="${m.level}"><button class="linkish" data-act="sfLine" data-row="${m.row}">line ${m.row + 1}</button> ${escapeHtml(m.message)}</li>`
      ).join('')
    : '<li class="ok">Reads fine.</li>';
}
function conditionMessageHTML(v, thing, field) {
  if (!v) return '';
  const p = conditionProblem(v);
  if (p) return `<span class="problem">${escapeHtml(p.message)} (at ${(p.col || 0) + 1})</span>`;
  const F = storyFindingsNow().filter(f => f.thing === thing && f.field === field);
  return F.map(f => `<span class="${f.level}">${escapeHtml(f.message)}</span>`).join(' ');
}

/* as you type: the parser at once, the checks a moment later (they read every script) */
let storyFieldTimer = null;
document.addEventListener('input', ev => {
  const el = ev.target;
  if (!el || !el.dataset || !(el.dataset.script || el.dataset.cond)) return;
  storyFound = null;
  const now = () => {
    if (el.dataset.script) {
      const box = el.closest('.scriptf');
      if (box) box.querySelector('.sf-msgs').innerHTML = scriptMessagesHTML(el.dataset.script, el.value);
    } else {
      const box = el.closest('.condf'),
        [thing, field] = (box ? box.dataset.cf : '|').split('|');
      if (box) box.querySelector('.cf-msg').innerHTML = conditionMessageHTML(el.value, thing, field);
    }
  };
  if (el.dataset.script && scriptProblem(scriptLinesOf(el.value))) now();
  clearTimeout(storyFieldTimer);
  storyFieldTimer = setTimeout(now, 250);
});
/* the caret's line, Tab and Shift+Tab indent by two spaces, Enter keeps the indent (and adds a level after a line
   that opens a block); Esc lets the next Tab leave the box */
const caretRow = ta => ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
const showCaretRow = ta => {
  const at = ta.closest('.scriptf') && ta.closest('.scriptf').querySelector('.sf-at');
  if (at) at.textContent = `Line ${caretRow(ta) + 1} of ${ta.value.split('\n').length}`;
};
let storyTabFree = null;
const OPENS_BLOCK = /^(choice|if\b.*|elif\b.*|else|once\b.*|cycle\b.*|seq\b.*|>.*)$/;
document.addEventListener('keydown', ev => {
  const ta = ev.target;
  if (!ta || ta.tagName !== 'TEXTAREA' || !ta.dataset.script) return;
  if (ev.key === 'Escape') {
    storyTabFree = ta;
    return;
  }
  if (ev.key === 'Tab' && storyTabFree !== ta && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
    ev.preventDefault();
    const s = ta.value,
      a = s.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    if (ev.shiftKey) {
      const n = /^ {0,2}/.exec(s.slice(a))[0].length;
      if (!n) return;
      const c = ta.selectionStart;
      ta.setRangeText('', a, a + n, 'preserve');
      ta.selectionStart = ta.selectionEnd = Math.max(a, c - n);
    } else ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
    const s = ta.value,
      a = s.lastIndexOf('\n', ta.selectionStart - 1) + 1,
      cur = s.slice(a, ta.selectionStart),
      ind = /^ */.exec(cur)[0].length + (OPENS_BLOCK.test(cur.trim()) ? 2 : 0);
    ev.preventDefault();
    ta.setRangeText('\n' + ' '.repeat(ind), ta.selectionStart, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (ev.key !== 'Escape') storyTabFree = null;
});
for (const t of ['keyup', 'click', 'focusin'])
  document.addEventListener(t, ev => {
    const ta = ev.target;
    if (ta && ta.tagName === 'TEXTAREA' && ta.dataset.script) {
      showCaretRow(ta);
      if (t === 'focusin') {
        storyLastBox = ta;
        ta.dataset.been = '1';
      }
    }
  });
let storyLastBox = null;
ACTIONS.sfLine = (d, el) => {
  const ta = el.closest('.scriptf').querySelector('textarea'),
    rows = ta.value.split('\n'),
    r = Math.min(+d.row, rows.length - 1),
    a = rows.slice(0, r).reduce((n, x) => n + x.length + 1, 0);
  ta.focus();
  ta.setSelectionRange(a, a + rows[r].length);
  ta.scrollTop = Math.max(0, (r - 2) * (ta.scrollHeight / Math.max(1, rows.length)));
  showCaretRow(ta);
};

/* ---------- line ids ---------- */
/* a hex string from a seed, for new line ids (the command line uses sha1; any spread-out hash keeps the rule: the
   tries go on until the id is new) */
export function lineIdHash(seed) {
  let a = 0x811c9dc5,
    b = 0x9e3779b9 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 2246822519);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
/** gives every line of dialogue and option without an id one, in every script (as npm run story:ids); how many */
function giveStudioLineIds(D = studioState.D) {
  const S = scriptsOf(D).map(sc => ({ id: sc.id, lines: sc.lines, put: L => (sc.owner.script = L) }));
  return giveLineIds(S, lineIdHash);
}
ACTIONS.sfIds = () => {
  const n = giveStudioLineIds();
  if (!n) return toast('Every line already has its id.');
  storyFound = null;
  changed();
  commit(true);
  render();
  toast(`${n} new line id${n === 1 ? '' : 's'}.`);
};

/* ---------- the command reference ---------- */
/* one panel beside the page; a row's button puts it in the last script box you were in */
ACTIONS.sfRef = (d, el) => {
  let P = document.getElementById('sfRef');
  if (P) {
    P.remove();
    document.querySelectorAll('[data-act="sfRef"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    return;
  }
  if (el && el.closest('.scriptf')) storyLastBox = el.closest('.scriptf').querySelector('textarea');
  P = document.createElement('aside');
  P.id = 'sfRef';
  P.className = 'sf-ref';
  P.setAttribute('aria-label', 'Script commands');
  P.innerHTML = `<header><h3>Script commands</h3><button class="btn sm" data-act="sfRef" aria-label="Close">✕</button></header><input type="search" id="sfRefQ" placeholder="Find…" aria-label="Find a command"><div class="sf-ref-b">${scriptReference()
    .map(
      S =>
        `<section><h4>${escapeHtml(S.title)}</h4><ul>${S.rows
          .map(
            r =>
              `<li data-q="${escapeHtml((r.use + ' ' + r.about).toLowerCase())}"><button class="linkish mono" data-act="sfInsert" data-use="${escapeHtml(r.use)}" title="Put it in the script">${escapeHtml(r.use)}</button>${r.tag ? ` <em>${escapeHtml(r.tag)}</em>` : ''}<small>${escapeHtml(r.about)}</small></li>`
          )
          .join('')}</ul></section>`
    )
    .join('')}</div>`;
  document.body.appendChild(P);
  document.querySelectorAll('[data-act="sfRef"]').forEach(b => b.setAttribute('aria-expanded', 'true'));
  const q = P.querySelector('#sfRefQ');
  q.addEventListener('input', () => {
    const w = q.value.trim().toLowerCase();
    P.querySelectorAll('li[data-q]').forEach(li => (li.hidden = !!w && !li.dataset.q.includes(w)));
  });
  q.focus();
};
ACTIONS.sfInsert = d => {
  const ta = storyLastBox && document.body.contains(storyLastBox) ? storyLastBox : null;
  if (!ta) return toast('Click in a script first, then pick what to put in it.');
  /* a box you haven't been in since the page was drawn takes it at its end */
  if (!ta.dataset.been) ta.selectionStart = ta.selectionEnd = ta.value.length;
  const s = ta.value,
    a = s.lastIndexOf('\n', ta.selectionStart - 1) + 1,
    ind = /^ */.exec(s.slice(a))[0],
    blank = !s.slice(a, ta.selectionStart).trim();
  ta.focus();
  ta.setRangeText(blank ? d.use : '\n' + ind + d.use, ta.selectionStart, ta.selectionEnd, 'end');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
};

/* ---------- the Story section: story.json ---------- */
SECTIONS.story = () => {
  const D = studioState.D,
    S = (D.story = D.story || {}),
    SC = (S.scripts = S.scripts || {}),
    ks = Object.keys(SC);
  if (!SC[studioState.sel.story]) studioState.sel.story = ks[0];
  const k = studioState.sel.story,
    T = SC[k],
    who = [
      ['', 'Whoever starts it'],
      ...Object.entries(S.speakers || {}).map(([n, id]) => [id, `${n} (${id})`]),
    ].filter((x, i, A) => A.findIndex(y => y[0] === x[0]) === i);
  const list = ks
    .map(
      x =>
        `<button class="lcard slim ${x === k ? 'on' : ''}" data-act="storyPick" data-id="${escapeHtml(x)}"><span class="lt"><b>${escapeHtml(x)}</b><small>${escapeHtml(SC[x].about || '')}</small></span></button>`
    )
    .join('');
  const table = (rows, head) =>
    rows.length
      ? `<table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : '<p class="help">None yet.</p>';
  const P = S.presets || {};
  const ref = `${card('Flags', table(Object.entries(S.flags || {}), ['Flag', 'What it means']) + table(Object.entries(S.patterns || {}), ['Pattern', 'What it means']), { sub: 'The story’s known flags (story.json). A script that sets a flag not listed here gets a note in the Check.' })}
 ${card(
   'Start presets',
   table(
     Object.entries(P).map(([n, p]) => [
       n,
       p.about || '',
       p.place || '',
       Object.keys(p.flags || {}).join(', '),
       (p.beaten || []).length,
     ]),
     ['Preset', 'About', 'Place', 'Flags', 'Beaten']
   ),
   {
     sub: 'Play from here (Walk scenes) starts a throwaway game at one of these. They are edited in story.json for now.',
   }
 )}
 ${card(
   'Quests',
   table(
     Object.entries(S.quests || {}).map(([q, Q]) => [q, (Q.stages || []).join(' → ')]),
     ['Quest', 'Stages']
   )
 )}`;
  const ed = T
    ? `${card(
        k,
        grid(
          textField('About (for you, not the player)', `story.scripts.${k}.about`),
          selectField('Who speaks a line without a name', `story.scripts.${k}.who`, who.slice(1), {
            opt: 1,
            none: who[0][1],
          })
        ) + scriptField('The script', 'story:' + k, { rows: 16 }),
        {
          acts: `<span class="seg-row"><button class="btn sm" data-act="storyRename">Rename</button><button class="btn sm danger subtle" data-act="storyDel">Remove</button></span>`,
          sub: `Started by the game itself (logic in story.js and the stage) or with <span class="mono">call story:${escapeHtml(k)}</span> from another script.`,
        }
      )}`
    : '';
  return `<div class="split"><aside class="list-col"><div class="list-head"><button class="btn primary" data-act="storyNew">+ New script</button></div>${list}</aside><div class="ed-col"><div class="ed-head"><h2>Story scripts</h2></div>${ed}${ref}</div></div>`;
};
ACTIONS.storyPick = d => {
  studioState.sel.story = d.id;
  render();
};
const storyKeyOk = k => /^[a-z0-9][a-z0-9-]*$/.test(k);
ACTIONS.storyNew = async () => {
  const SC = studioState.D.story.scripts,
    k = await dialog(
      'New story script',
      `<label class="fld"><span>Its key (small letters, digits and -; scripts call it as story:key)</span><input type="text" id="storyKey" class="mono"></label>`,
      [
        { l: 'Cancel', v: null },
        {
          l: 'Make it',
          c: 'primary',
          f: m => {
            const v = m.querySelector('#storyKey').value.trim();
            if (!storyKeyOk(v) || SC[v]) {
              toast(SC[v] ? 'There is a script with that key.' : 'Small letters, digits and - only.');
              return false;
            }
            return v;
          },
        },
      ]
    );
  if (!k) return;
  SC[k] = { about: '', script: ['Hello. #l:' + lineIdHash('story:' + k).slice(0, 4)] };
  studioState.sel.story = k;
  storyFound = null;
  changed();
  commit(true);
  render();
};
ACTIONS.storyRename = async () => {
  const SC = studioState.D.story.scripts,
    old = studioState.sel.story;
  const k = await dialog(
    'Rename the script',
    `<p class="help">Scripts that call story:${escapeHtml(old)} are not changed; the Check lists them.</p><label class="fld"><span>New key</span><input type="text" id="storyKey" class="mono" value="${escapeHtml(old)}"></label>`,
    [
      { l: 'Cancel', v: null },
      {
        l: 'Rename',
        c: 'primary',
        f: m => {
          const v = m.querySelector('#storyKey').value.trim();
          if (v !== old && (!storyKeyOk(v) || SC[v])) {
            toast(SC[v] ? 'There is a script with that key.' : 'Small letters, digits and - only.');
            return false;
          }
          return v;
        },
      },
    ]
  );
  if (!k || k === old) return;
  studioState.D.story.scripts = Object.fromEntries(Object.entries(SC).map(([x, v]) => [x === old ? k : x, v]));
  studioState.sel.story = k;
  storyFound = null;
  changed();
  commit(true);
  render();
};
ACTIONS.storyDel = async () => {
  const k = studioState.sel.story;
  if (!(await ask(`Remove the story script ${escapeHtml(k)}? Scripts that call it will show in the Check.`, 'Remove')))
    return;
  delete studioState.D.story.scripts[k];
  storyFound = null;
  changed();
  commit(true);
  render();
};
/* a person's id names their script (person:<id>): after it changes, the page is drawn again so the box follows it */
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el && el.dataset && /^maps\.[^.]+\.people\.\d+\.id$/.test(el.dataset.p || '')) render();
});
