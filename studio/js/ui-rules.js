'use strict';
/* ================= POCKET BILLIES STUDIO · the UI rule check (UI track, UI-3b) =================
   The rules tools/ui-lint.mjs counts (game/js/logic/ui-lint.js), run on the game's own files: the Check shows one
   report line (report only until UI-6, so it is not counted in the Check's badge) and its Show me opens the list in
   the UI look section: each raw value with its file, line and the line's text, linked to that line on GitHub. The
   files are read once, the way the browser can (the pages and what their modules import), as the page has them:
   the Studio does not edit CSS or code, so the list changes only when the page is loaded again. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { escapeHtml } from './game-stand-ins.js';
import { UI_LINT_RULES, uiLintCrawl, uiLintFindings } from '../../game/js/logic/ui-lint.js';
import { ACTIONS, afterRender } from './studio-app.js';
import { scheduleCheck } from './check.js';
import { GITHUB_CONFIG } from './github.js';
/* eslint-disable no-func-assign */
expose({
  UI_RULES_ROWS: [() => UI_RULES_ROWS],
  uiRuleName: [() => uiRuleName],
  uiRules: [() => uiRules],
  uiRulesCheckLine: [() => uiRulesCheckLine, v => ((uiRulesCheckLine = v), provide({ uiRulesCheckLine }))],
  uiRulesCounts: [() => uiRulesCounts, v => (uiRulesCounts = v)],
  uiRulesHTML: [() => uiRulesHTML, v => ((uiRulesHTML = v), provide({ uiRulesHTML }))],
  uiRulesLink: [() => uiRulesLink],
  uiRulesLoad: [() => uiRulesLoad, v => (uiRulesLoad = v)],
  uiRulesRefresh: [() => uiRulesRefresh, v => (uiRulesRefresh = v)],
  uiRulesShow: [() => uiRulesShow, v => ((uiRulesShow = v), provide({ uiRulesShow }))],
});
/* eslint-enable no-func-assign */
provide({ uiRulesCheckLine, uiRulesHTML, uiRulesShow });
/* to-module: end */
const uiRules = {
  state: 'idle', // idle, loading, ready, failed
  files: 0,
  /** @type {{rule: string, file: string, line: number, text: string}[]} */
  found: [],
  err: '',
  open: false,
  rule: '',
  file: '',
};
/** the most rows the list shows at once (filter by rule or file for the rest) */
const UI_RULES_ROWS = 300;

/** read the game's files and lint them (once); the Check and the section show the result when it comes */
function uiRulesLoad() {
  if (uiRules.state !== 'idle') return;
  uiRules.state = 'loading';
  const cache = new Map();
  const read = p => {
    if (!cache.has(p))
      cache.set(
        p,
        fetch('../' + p).then(r => {
          if (!r.ok) throw new Error(`${p}: ${r.status}`);
          return r.text();
        })
      );
    return cache.get(p);
  };
  uiLintCrawl(read)
    .then(async files => {
      const texts = await Promise.all(files.map(read));
      uiRules.found = files.flatMap((f, i) => uiLintFindings(texts[i], f));
      uiRules.files = files.length;
      uiRules.state = 'ready';
    })
    .catch(e => {
      uiRules.err = e.message;
      uiRules.state = 'failed';
    })
    .finally(() => {
      scheduleCheck();
      uiRulesRefresh();
    });
}

/** raw values per rule: [[rule, n]], most first */
function uiRulesCounts(found = uiRules.found) {
  const n = {};
  for (const f of found) n[f.rule] = (n[f.rule] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1]);
}
const uiRuleName = id => (UI_LINT_RULES.find(r => r.id === id) || { name: id }).name;

/** the Check's one line (null while the files are still being read) */
function uiRulesCheckLine() {
  uiRulesLoad();
  if (uiRules.state === 'failed') return `UI rules: couldn’t read the game’s files (${uiRules.err}).`;
  if (uiRules.state !== 'ready') return null;
  const top = uiRulesCounts()
    .slice(0, 3)
    .map(([r, n]) => `${uiRuleName(r).toLowerCase()} ${n}`)
    .join(', ');
  return `UI rules: ${uiRules.found.length} raw values in ${uiRules.files} files (${top}…). A report until UI-6, not a problem yet.`;
}

/** a line on GitHub (the branch the Studio proposes to) */
const uiRulesLink = (file, line) =>
  `https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/blob/${GITHUB_CONFIG.branch}/${file}#L${line}`;

/** the card in the UI look section */
function uiRulesHTML() {
  const R = uiRules,
    open = R.open;
  let body = '';
  if (open) {
    if (R.state === 'failed') body = `<p class="help">Couldn’t read the game’s files: ${escapeHtml(R.err)}</p>`;
    else if (R.state !== 'ready') body = '<p class="help">Reading the game’s files…</p>';
    else {
      const byRule = R.rule ? R.found.filter(f => f.rule === R.rule) : R.found,
        files = [...new Set(byRule.map(f => f.file))].sort(),
        rows = R.file ? byRule.filter(f => f.file === R.file) : byRule,
        perFile = {};
      for (const f of byRule) perFile[f.file] = (perFile[f.file] || 0) + 1;
      body = `<p class="help">The raw values tools/ui-lint.mjs counts (docs/phases/06-plan.md): each should be a token. A report only until UI-6, when the rules start to fail. The Studio doesn’t edit these files; a line opens on GitHub.</p>
 <div class="seg-row"><select id="uiRulesRule" aria-label="Rule"><option value="">Every rule · ${R.found.length}</option>${uiRulesCounts()
   .map(
     ([r, n]) => `<option value="${r}" ${R.rule === r ? 'selected' : ''}>${escapeHtml(uiRuleName(r))} · ${n}</option>`
   )
   .join(
     ''
   )}</select><select id="uiRulesFile" aria-label="File"><option value="">Every file · ${files.length}</option>${files
   .map(
     f =>
       `<option value="${escapeHtml(f)}" ${R.file === f ? 'selected' : ''}>${escapeHtml(f.replace(/^game\//, ''))} · ${perFile[f]}</option>`
   )
   .join('')}</select></div>
 <ol class="ui-rules">${rows
   .slice(0, UI_RULES_ROWS)
   .map(
     f =>
       `<li data-rule="${f.rule}"><a href="${uiRulesLink(f.file, f.line)}" target="_blank" rel="noopener">${escapeHtml(f.file.replace(/^game\//, ''))}:${f.line}</a><span>${escapeHtml(uiRuleName(f.rule))}</span><code>${escapeHtml(f.text)}</code></li>`
   )
   .join(
     ''
   )}</ol>${rows.length > UI_RULES_ROWS ? `<p class="help">${rows.length - UI_RULES_ROWS} more: pick a rule or a file.</p>` : ''}`;
    }
  }
  const n = R.state === 'ready' ? R.found.length : 0;
  return `<section class="card eng-g ${open ? 'open' : ''}" id="uiRules"><header><button class="eng-gh" data-act="uiRulesOpen"><span class="eng-tw">${open ? '▾' : '▸'}</span><h3>Rule check</h3>${n ? `<span class="badge">${n} raw</span>` : ''}</button></header>
 ${open ? `<div class="card-b">${body}</div>` : ''}</section>`;
}

/** draw the card again where it is */
function uiRulesRefresh() {
  const el = $('#uiRules');
  if (el) el.outerHTML = uiRulesHTML();
}
ACTIONS.uiRulesOpen = () => {
  uiRules.open = !uiRules.open;
  uiRulesLoad();
  uiRulesRefresh();
};
document.addEventListener('change', ev => {
  const t = /** @type {HTMLSelectElement} */ (ev.target);
  if (t.id === 'uiRulesRule') {
    uiRules.rule = t.value;
    uiRules.file = '';
  } else if (t.id === 'uiRulesFile') uiRules.file = t.value;
  else return;
  uiRulesRefresh();
});
/** the Check's Show me: open the card and bring it into view */
function uiRulesShow() {
  uiRules.open = true;
  uiRulesLoad();
  afterRender(() => {
    uiRulesRefresh();
    const el = $('#uiRules');
    if (el) el.scrollIntoView({ block: 'start' });
  });
}
