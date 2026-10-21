'use strict';
/* ================= POCKET BILLIES STUDIO · on GitHub (alpha 0.4.1) =================
   The Studio also runs straight from the game's GitHub Pages site (…/studio/). There is no Studio server there, so
   this file stands in for it, talking to GitHub instead:
   - Sign in: an admin pastes a GitHub token (the sign-in screen walks them through making one). Only people listed in
     studio/admins.json, or the repository's owner, get in; they also need write access to the repository.
   - The game data, skeletons and art are read from the repository's main branch.
   - Save to game: everything you changed goes on a new branch as one commit, and a pull request is opened. Nothing in
     the game changes until the repository's owner merges it (GitHub → Pull requests).
   Started from start-studio.py on your own computer, none of this is used: saves go straight into the game folder. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  ask,
  boot,
  dialog,
  saveAll,
  setApi,
  setSaveAll,
  setToast,
  studioState,
  toast,
  updateTopBar,
} from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  GITHUB_CONFIG: [() => GITHUB_CONFIG],
  GITHUB_TOKEN_KEY: [() => GITHUB_TOKEN_KEY],
  RIG_FILE_HEADERS: [() => RIG_FILE_HEADERS],
  changedDataFiles: [() => changedDataFiles, v => (changedDataFiles = v)],
  checkGithubToken: [() => checkGithubToken, v => (checkGithubToken = v)],
  gameFilePath: [() => gameFilePath],
  githubFetch: [() => githubFetch, v => (githubFetch = v)],
  githubLogin: [() => githubLogin, v => (githubLogin = v)],
  githubLoginHTML: [() => githubLoginHTML, v => (githubLoginHTML = v)],
  githubMode: [() => githubMode],
  parseScriptJson: [() => parseScriptJson],
  proposeOnGithub: [() => proposeOnGithub, v => (proposeOnGithub = v)],
  readGithubData: [() => readGithubData, v => (readGithubData = v)],
  repoApiPath: [() => repoApiPath],
  startGithubMode: [() => startGithubMode, v => (startGithubMode = v)],
  studioApiViaGithub: [() => studioApiViaGithub, v => (studioApiViaGithub = v)],
  textToBase64: [() => textToBase64],
  toBase64: [() => toBase64],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const GITHUB_CONFIG = Object.assign(
  { owner: 'nojiroh', repo: 'pocket-billies', branch: 'main', game: 'game' },
  window.PB_STUDIO_GITHUB || {}
);
const githubMode = {
  on: window.STUDIO_KEY === '__STUDIO_KEY__' || !window.STUDIO_KEY,
  token: '',
  login: '',
  batch: null,
  tree: null,
  data: {}, // the text of each data file as read, to send only the ones that change
};
const GITHUB_TOKEN_KEY = 'pb-studio-gh-token';
const RIG_FILE_HEADERS = {
  rigs: '/* Billionaire skeletons (bones, pivots, draw order) for art/billionaires/*.png. Edited by Pocket Billies Studio. */\n',
  next: '/* v36: rigs for the new piece sheets (art/next/billionaires), made by tools/build-starter-sheets.py and edited by Pocket Billies Studio. k=1: pieces at the final scale. */\n',
};
async function githubFetch(path, opt = {}, raw) {
  const r = await fetch('https://api.github.com/' + path, {
    ...opt,
    headers: {
      Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(githubMode.token ? { Authorization: 'Bearer ' + githubMode.token } : {}),
      ...(opt.headers || {}),
    },
  });
  if (!r.ok) {
    let m = r.statusText;
    try {
      m = (await r.json()).message || m;
    } catch (e) {}
    const e = new Error(m);
    e.status = r.status;
    throw e;
  }
  return raw ? r.text() : r.status === 204 ? null : r.json();
}
const repoApiPath = p => `repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}${p ? '/' + p : ''}`;
const gameFilePath = p => (GITHUB_CONFIG.game ? GITHUB_CONFIG.game + '/' : '') + p;
const parseScriptJson = (t, name) => {
  const i = t.indexOf(name + '=');
  if (i < 0) throw new Error(`${name} not found`);
  return JSON.parse(
    t
      .slice(i + name.length + 1)
      .trim()
      .replace(/;\s*$/, '')
  );
};
const toBase64 = buf => {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const textToBase64 = t => toBase64(new TextEncoder().encode(t));
/* ---------- sign-in ---------- */
async function checkGithubToken(token) {
  githubMode.token = token;
  const me = await githubFetch('user');
  const repo = await githubFetch(repoApiPath(''));
  let admins = [];
  try {
    admins =
      JSON.parse(await githubFetch(repoApiPath(`contents/studio/admins.json?ref=${GITHUB_CONFIG.branch}`), {}, true))
        .admins || [];
  } catch (e) {}
  const isOwner = me.login.toLowerCase() === GITHUB_CONFIG.owner.toLowerCase(),
    listed = admins.some(a => String(a).toLowerCase() === me.login.toLowerCase());
  if (!(isOwner || listed || (repo.permissions && repo.permissions.admin)))
    throw new Error(`${me.login} isn’t a Studio admin for this game. The owner can add you to studio/admins.json.`);
  if (!(repo.permissions && repo.permissions.push))
    throw new Error(
      `${me.login} can’t write to ${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}. The owner can add you as a collaborator (repository Settings → Collaborators).`
    );
  githubMode.login = me.login;
  return me;
}
function githubLoginHTML(err) {
  /* SECURITY.md option A (RL-1): a fine-grained token for this one repository, so a stolen one can't touch others */
  const tok = `https://github.com/settings/personal-access-tokens/new?name=${encodeURIComponent('Pocket Billies Studio')}&expires_in=90&contents=write&pull_requests=write`;
  return `<div class="gh-login"><div class="gh-card"><img src="../game/art/coins/penny_32.png" width="40" height="40" alt=""><h2>Pocket Billies Studio</h2>
 <p>Sign in with GitHub to edit the game. Only Studio admins get in, and what you save becomes a <b>pull request</b>: the game changes only when ${escapeHtml(GITHUB_CONFIG.owner)} approves it.</p>
 <ol class="gh-steps"><li><a href="${tok}" target="_blank" rel="noopener">Open GitHub’s “new fine-grained token” page</a> (signed in as yourself). The name and 90 days are filled in.</li>
 <li>Under <b>Repository access</b> pick <b>Only select repositories</b> and choose <b>${escapeHtml(GITHUB_CONFIG.owner)}/${escapeHtml(GITHUB_CONFIG.repo)}</b>. Under <b>Permissions</b> check that <b>Contents</b> and <b>Pull requests</b> say <b>Read and write</b>.</li>
 <li>Click <b>Generate token</b>, copy it (it starts with <code>github_pat_</code>) and paste it here.</li></ol>
 <label class="fld"><span>GitHub token</span><input type="password" id="ghTok" autocomplete="off" placeholder="github_pat_…"></label>
 <label class="fld chk"><input type="checkbox" id="ghKeep"><span>Remember me on this computer</span></label>
 ${err ? `<p class="gh-err">${escapeHtml(err)}</p>` : ''}<button class="btn primary" id="ghGo">Sign in</button>
 <p class="help">The token is only sent to GitHub. Without “Remember me” it is forgotten when this tab closes; with it, it stays in this browser. To sign out, use the button at the top; to cut it off for good, delete it on GitHub (Settings → Developer settings → Tokens).</p></div></div>`;
}
function githubLogin(err) {
  return new Promise(res => {
    let w = $('#ghLogin');
    if (!w) {
      w = document.createElement('div');
      w.id = 'ghLogin';
      document.body.appendChild(w);
    }
    w.innerHTML = githubLoginHTML(err);
    const go = async () => {
      const t = $('#ghTok').value.trim();
      if (!t) return;
      $('#ghGo').disabled = true;
      $('#ghGo').textContent = 'Checking…';
      try {
        await checkGithubToken(t);
        try {
          if ($('#ghKeep').checked) localStorage.setItem(GITHUB_TOKEN_KEY, t);
          else sessionStorage.setItem(GITHUB_TOKEN_KEY, t);
        } catch (e) {}
        w.remove();
        res();
      } catch (e) {
        githubMode.token = '';
        w.innerHTML = githubLoginHTML(
          e.status === 401 ? 'GitHub didn’t accept that token. Copy it again, all of it.' : e.message
        );
        bind();
      }
    };
    const bind = () => {
      $('#ghGo').onclick = go;
      $('#ghTok').onkeydown = e => {
        if (e.key === 'Enter') go();
      };
      $('#ghTok').focus();
    };
    bind();
  });
}
async function startGithubMode() {
  let t = '';
  try {
    t = localStorage.getItem(GITHUB_TOKEN_KEY) || sessionStorage.getItem(GITHUB_TOKEN_KEY) || '';
  } catch (e) {}
  if (t) {
    try {
      await checkGithubToken(t);
    } catch (e) {
      try {
        localStorage.removeItem(GITHUB_TOKEN_KEY);
        sessionStorage.removeItem(GITHUB_TOKEN_KEY);
      } catch (e2) {}
      await githubLogin(e.status === 401 ? 'That saved sign-in has expired. Make a new token.' : e.message);
    }
  } else await githubLogin();
  const a = $('.top-acts');
  if (a && !$('#ghWho'))
    a.insertAdjacentHTML(
      'afterbegin',
      `<button class="tb" id="ghWho" data-act="ghOut" title="Signed in to GitHub as ${escapeHtml(githubMode.login)}. Click to sign out.">⎋ ${escapeHtml(githubMode.login)}</button>`
    );
  const sb = $('#saveBtn');
  if (sb) {
    sb.textContent = 'Propose changes';
    sb.title = 'Send everything you changed to the owner as a pull request (Ctrl+S)';
  }
}
ACTIONS.ghOut = async () => {
  if (studioState.dirty || studioState.rigsDirty || studioState.artDirty.size) {
    if (!(await ask('You have changes you haven’t proposed yet. Sign out anyway? They will be lost.', 'Sign out')))
      return;
  }
  try {
    localStorage.removeItem(GITHUB_TOKEN_KEY);
    sessionStorage.removeItem(GITHUB_TOKEN_KEY);
  } catch (e) {}
  location.reload();
};
/* ---------- the game data: many files in game/data (phase 04b, layout in game/js/data-files.js) ----------
   Read: index.json, then every file it lists, a few at a time. Their text is kept, so a proposal sends only the files
   that changed (and removes the files of entries that were deleted). */
async function readGithubData() {
  const read = path =>
    githubFetch(repoApiPath(`contents/${gameFilePath('data/' + path)}?ref=${GITHUB_CONFIG.branch}`), {}, true);
  const index = JSON.parse(await read('index.json')),
    list = PB_DATA.files(index),
    texts = { 'index.json': PB_DATA.text(index) };
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const f = list[next++];
      texts[f.path] = await read(f.path);
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
  githubMode.data = {};
  const D = PB_DATA.assemble(index, path => {
    const v = JSON.parse(texts[path]);
    githubMode.data[path] = PB_DATA.text(v);
    return v;
  });
  githubMode.data['index.json'] = texts['index.json'];
  return D;
}
function changedDataFiles(D) {
  const { index, files } = PB_DATA.split(D),
    now = { 'index.json': PB_DATA.text(index) },
    out = [];
  for (const [path, v] of Object.entries(files)) now[path] = PB_DATA.text(v);
  for (const [path, text] of Object.entries(now))
    if (githubMode.data[path] !== text) out.push({ path: gameFilePath('data/' + path), text });
  for (const path of Object.keys(githubMode.data))
    if (!(path in now)) out.push({ path: gameFilePath('data/' + path), gone: true });
  return out;
}
/* ---------- the Studio's server calls, answered from GitHub ---------- */
async function studioApiViaGithub(path, opt = {}) {
  const [p, qs] = path.split('?'),
    q = new URLSearchParams(qs || ''),
    post = (opt.method || 'GET') === 'POST';
  if (!post) {
    if (p === 'gamedata') return readGithubData();
    if (p === 'rigs') {
      const R = parseScriptJson(
        await githubFetch(repoApiPath(`contents/${gameFilePath('art/rigs.js')}?ref=${GITHUB_CONFIG.branch}`), {}, true),
        'window.RIGS'
      );
      return R;
    }
    if (p === 'files') {
      if (!githubMode.tree)
        githubMode.tree = (await githubFetch(repoApiPath(`git/trees/${GITHUB_CONFIG.branch}?recursive=1`))).tree;
      const pre = gameFilePath('art/' + (q.get('dir') || '').replace(/^\/|\/$/g, '')).replace(/\/$/, '') + '/';
      return githubMode.tree
        .filter(
          t =>
            t.type === 'blob' &&
            t.path.startsWith(pre) &&
            /\.(png|webp|jpg|svg)$/i.test(t.path) &&
            !t.path.includes('.backups')
        )
        .map(t => ({
          path: t.path.slice(GITHUB_CONFIG.game ? GITHUB_CONFIG.game.length + 1 : 0),
          size: t.size,
          mtime: 0,
        }));
    }
    if (p === 'backups') return [];
    throw new Error('Unknown request.');
  }
  if (!githubMode.batch) throw new Error('Saving goes through “Propose changes”.');
  if (p === 'gamedata') {
    githubMode.batch.push(...changedDataFiles(JSON.parse(opt.body)));
    return { ok: true };
  }
  if (p === 'rigs') {
    const data = JSON.parse(opt.body),
      isNext = r =>
        r &&
        typeof r === 'object' &&
        Object.values(r).some(v => v && typeof v === 'object' && String(v.sheet || '').startsWith('next/')),
      nxt = {},
      old = {};
    for (const [k, v] of Object.entries(data)) (isNext(v) ? nxt : old)[k] = v;
    githubMode.batch.push(
      { path: gameFilePath('art/rigs.js'), text: RIG_FILE_HEADERS.rigs + 'window.RIGS=' + JSON.stringify(old) + ';\n' },
      {
        path: gameFilePath('art/next/rigs-next.js'),
        text: RIG_FILE_HEADERS.next + 'window.RIGS_NEXT=' + JSON.stringify(nxt) + ';\n',
      }
    );
    return { ok: true };
  }
  if (p === 'file') {
    const rel = q.get('path') || '';
    if (!/^art\/[\w\-./]+\.(png|webp)$/i.test(rel) || rel.includes('..')) throw new Error('Bad art path.');
    githubMode.batch.push({ path: gameFilePath(rel), blob: await opt.body.arrayBuffer() });
    return { ok: true };
  }
  if (p === 'restore')
    throw new Error(
      'On GitHub, earlier versions are in the repository’s history; ask the owner to roll a change back.'
    );
  throw new Error('Unknown request.');
}
/* everything saved in one go: a branch, one commit, a pull request */
async function proposeOnGithub(summary) {
  const files = githubMode.batch;
  githubMode.batch = null;
  if (!files.length) return null;
  const base = await githubFetch(repoApiPath(`git/ref/heads/${GITHUB_CONFIG.branch}`)),
    baseSha = base.object.sha,
    baseCommit = await githubFetch(repoApiPath(`git/commits/${baseSha}`));
  const tree = [];
  for (const f of files) {
    if (f.gone) {
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    const blob = await githubFetch(repoApiPath('git/blobs'), {
      method: 'POST',
      body: JSON.stringify({ content: f.blob ? toBase64(f.blob) : textToBase64(f.text), encoding: 'base64' }),
    });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const t = await githubFetch(repoApiPath('git/trees'), {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
  });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, ''),
    branch = `studio/${githubMode.login}-${stamp}`;
  const c = await githubFetch(repoApiPath('git/commits'), {
    method: 'POST',
    body: JSON.stringify({
      message: `Studio: ${summary}\n\nProposed by ${githubMode.login} in Pocket Billies Studio.`,
      tree: t.sha,
      parents: [baseSha],
    }),
  });
  await githubFetch(repoApiPath('git/refs'), {
    method: 'POST',
    body: JSON.stringify({ ref: 'refs/heads/' + branch, sha: c.sha }),
  });
  const pr = await githubFetch(repoApiPath('pulls'), {
    method: 'POST',
    body: JSON.stringify({
      title: `Studio: ${summary}`,
      head: branch,
      base: GITHUB_CONFIG.branch,
      body: `Proposed by @${githubMode.login} in Pocket Billies Studio.\n\nChanged files:\n${files.map(f => '- `' + f.path + '`').join('\n')}\n\nMerge this pull request to put the changes in the game; close it to turn them down.`,
    }),
  });
  return pr;
}
/* the Studio's own api() and saveAll() take this route when it runs from GitHub */
if (githubMode.on) {
  setApi(studioApiViaGithub);
  const save0 = saveAll;
  setSaveAll(async function () {
    if ($('#saveBtn').disabled) return;
    const what = await dialog(
      'Propose these changes',
      '<label class="fld"><span>What did you change? (the owner sees this)</span><input type="text" id="ghSum" maxlength="90" placeholder="New props in Copperleaf, brighter lamps"></label>',
      [
        { l: 'Cancel', v: null },
        {
          l: 'Propose changes',
          c: 'primary',
          f: m => (m.querySelector('#ghSum').value || '').trim() || 'changes from the Studio',
        },
      ]
    );
    if (!what) return;
    githubMode.batch = [];
    const t0 = toast;
    let pr = null,
      err = null;
    setToast((t, k) => {
      if (k === 'err') t0(t, k);
    });
    let none = false;
    try {
      await save0();
      none = !(githubMode.batch && githubMode.batch.length);
      if (!none) {
        $('#saveBtn').textContent = 'Sending…';
        pr = await proposeOnGithub(what);
      }
    } catch (e) {
      err = e;
    } finally {
      setToast(t0);
      githubMode.batch = null;
      $('#saveBtn').textContent = 'Propose changes';
      $('#saveBtn').disabled = false;
    }
    if (err) {
      studioState.dirty = true;
      updateTopBar();
      return toast('Couldn’t send the changes: ' + err.message, 'err');
    }
    if (pr) {
      await dialog(
        'Sent for approval',
        `<p>Your changes are pull request <b>#${pr.number}</b>. They go into the game when ${escapeHtml(GITHUB_CONFIG.owner)} merges it. Until then the Studio (and the game) show the game as it is now.</p><p><a href="${escapeHtml(pr.html_url)}" target="_blank" rel="noopener">Open the pull request on GitHub</a></p>`,
        [{ l: 'OK', c: 'primary', v: 1 }]
      );
    } else if (none && !(studioState.dirty || studioState.rigsDirty || studioState.artDirty.size))
      toast('Nothing to send: everything is as it is in the game.');
  });
  /* the Studio waits for sign-in before it loads anything */
  const boot0 = boot;
  removeEventListener('load', boot);
  addEventListener('load', async () => {
    await startGithubMode();
    boot0();
  });
}
