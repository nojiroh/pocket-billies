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
import { expose } from '../../game/js/bridge.js';
import { $ } from '../../game/js/util.js';
import { esc } from './shims.js';
import { ACTS, ST, ask, boot, dialog, updTop } from './core.js';
/* eslint-disable no-func-assign */
expose({
  GH: [() => GH],
  GH_CFG: [() => GH_CFG],
  GH_HEAD: [() => GH_HEAD],
  GH_KEY: [() => GH_KEY],
  b64: [() => b64],
  b64text: [() => b64text],
  gh: [() => gh, v => (gh = v)],
  ghApi: [() => ghApi, v => (ghApi = v)],
  ghCheck: [() => ghCheck, v => (ghCheck = v)],
  ghDataChanges: [() => ghDataChanges, v => (ghDataChanges = v)],
  ghJsJson: [() => ghJsJson],
  ghLogin: [() => ghLogin, v => (ghLogin = v)],
  ghLoginHTML: [() => ghLoginHTML, v => (ghLoginHTML = v)],
  ghPath: [() => ghPath],
  ghPropose: [() => ghPropose, v => (ghPropose = v)],
  ghReadData: [() => ghReadData, v => (ghReadData = v)],
  ghRepo: [() => ghRepo],
  ghStart: [() => ghStart, v => (ghStart = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const GH_CFG = Object.assign(
  { owner: 'nojiroh', repo: 'pocket-billies', branch: 'main', game: 'game' },
  window.PB_STUDIO_GITHUB || {}
);
const GH = {
  on: window.STUDIO_KEY === '__STUDIO_KEY__' || !window.STUDIO_KEY,
  token: '',
  login: '',
  batch: null,
  tree: null,
  data: {}, // the text of each data file as read, to send only the ones that change
};
const GH_KEY = 'pb-studio-gh-token';
const GH_HEAD = {
  rigs: '/* Billionaire skeletons (bones, pivots, draw order) for art/billionaires/*.png. Edited by Pocket Billies Studio. */\n',
  next: '/* v36: rigs for the new piece sheets (art/next/billionaires), made by tools/build-starter-sheets.py and edited by Pocket Billies Studio. k=1: pieces at the final scale. */\n',
};
async function gh(path, opt = {}, raw) {
  const r = await fetch('https://api.github.com/' + path, {
    ...opt,
    headers: {
      Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(GH.token ? { Authorization: 'Bearer ' + GH.token } : {}),
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
const ghRepo = p => `repos/${GH_CFG.owner}/${GH_CFG.repo}/${p}`;
const ghPath = p => (GH_CFG.game ? GH_CFG.game + '/' : '') + p;
const ghJsJson = (t, name) => {
  const i = t.indexOf(name + '=');
  if (i < 0) throw new Error(`${name} not found`);
  return JSON.parse(
    t
      .slice(i + name.length + 1)
      .trim()
      .replace(/;\s*$/, '')
  );
};
const b64 = buf => {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const b64text = t => b64(new TextEncoder().encode(t));
/* ---------- sign-in ---------- */
async function ghCheck(token) {
  GH.token = token;
  const me = await gh('user');
  const repo = await gh(ghRepo(''));
  let admins = [];
  try {
    admins = JSON.parse(await gh(ghRepo(`contents/studio/admins.json?ref=${GH_CFG.branch}`), {}, true)).admins || [];
  } catch (e) {}
  const isOwner = me.login.toLowerCase() === GH_CFG.owner.toLowerCase(),
    listed = admins.some(a => String(a).toLowerCase() === me.login.toLowerCase());
  if (!(isOwner || listed || (repo.permissions && repo.permissions.admin)))
    throw new Error(`${me.login} isn’t a Studio admin for this game. The owner can add you to studio/admins.json.`);
  if (!(repo.permissions && repo.permissions.push))
    throw new Error(
      `${me.login} can’t write to ${GH_CFG.owner}/${GH_CFG.repo}. The owner can add you as a collaborator (repository Settings → Collaborators).`
    );
  GH.login = me.login;
  return me;
}
function ghLoginHTML(err) {
  const tok = `https://github.com/settings/tokens/new?scopes=public_repo&description=${encodeURIComponent('Pocket Billies Studio')}`;
  return `<div class="gh-login"><div class="gh-card"><img src="../game/art/coins/penny_32.png" width="40" height="40" alt=""><h2>Pocket Billies Studio</h2>
 <p>Sign in with GitHub to edit the game. Only Studio admins get in, and what you save becomes a <b>pull request</b>: the game changes only when ${esc(GH_CFG.owner)} approves it.</p>
 <ol class="gh-steps"><li><a href="${tok}" target="_blank" rel="noopener">Open GitHub’s “new token” page</a> (signed in as yourself). The name and the <b>public_repo</b> box are filled in already.</li>
 <li>Pick how long it lasts (90 days is fine), scroll down and click <b>Generate token</b>.</li><li>Copy the token (it starts with <code>ghp_</code>) and paste it here.</li></ol>
 <label class="fld"><span>GitHub token</span><input type="password" id="ghTok" autocomplete="off" placeholder="ghp_…"></label>
 <label class="fld chk"><input type="checkbox" id="ghKeep" checked><span>Remember me on this computer</span></label>
 ${err ? `<p class="gh-err">${esc(err)}</p>` : ''}<button class="btn primary" id="ghGo">Sign in</button>
 <p class="help">The token stays in this browser and is only sent to GitHub. To sign out, use the button at the top; to cut it off for good, delete it on GitHub (Settings → Developer settings → Tokens).</p></div></div>`;
}
function ghLogin(err) {
  return new Promise(res => {
    let w = $('#ghLogin');
    if (!w) {
      w = document.createElement('div');
      w.id = 'ghLogin';
      document.body.appendChild(w);
    }
    w.innerHTML = ghLoginHTML(err);
    const go = async () => {
      const t = $('#ghTok').value.trim();
      if (!t) return;
      $('#ghGo').disabled = true;
      $('#ghGo').textContent = 'Checking…';
      try {
        await ghCheck(t);
        try {
          if ($('#ghKeep').checked) localStorage.setItem(GH_KEY, t);
          else sessionStorage.setItem(GH_KEY, t);
        } catch (e) {}
        w.remove();
        res();
      } catch (e) {
        GH.token = '';
        w.innerHTML = ghLoginHTML(
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
async function ghStart() {
  let t = '';
  try {
    t = localStorage.getItem(GH_KEY) || sessionStorage.getItem(GH_KEY) || '';
  } catch (e) {}
  if (t) {
    try {
      await ghCheck(t);
    } catch (e) {
      try {
        localStorage.removeItem(GH_KEY);
        sessionStorage.removeItem(GH_KEY);
      } catch (e2) {}
      await ghLogin(e.status === 401 ? 'That saved sign-in has expired. Make a new token.' : e.message);
    }
  } else await ghLogin();
  const a = $('.top-acts');
  if (a && !$('#ghWho'))
    a.insertAdjacentHTML(
      'afterbegin',
      `<button class="tb" id="ghWho" data-act="ghOut" title="Signed in to GitHub as ${esc(GH.login)}. Click to sign out.">⎋ ${esc(GH.login)}</button>`
    );
  const sb = $('#saveBtn');
  if (sb) {
    sb.textContent = 'Propose changes';
    sb.title = 'Send everything you changed to the owner as a pull request (Ctrl+S)';
  }
}
ACTS.ghOut = async () => {
  if (ST.dirty || ST.rigsDirty || ST.artDirty.size) {
    if (!(await ask('You have changes you haven’t proposed yet. Sign out anyway? They will be lost.', 'Sign out')))
      return;
  }
  try {
    localStorage.removeItem(GH_KEY);
    sessionStorage.removeItem(GH_KEY);
  } catch (e) {}
  location.reload();
};
/* ---------- the game data: many files in game/data (phase 04b, layout in game/js/data-files.js) ----------
   Read: index.json, then every file it lists, a few at a time. Their text is kept, so a proposal sends only the files
   that changed (and removes the files of entries that were deleted). */
async function ghReadData() {
  const read = path => gh(ghRepo(`contents/${ghPath('data/' + path)}?ref=${GH_CFG.branch}`), {}, true);
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
  GH.data = {};
  const D = PB_DATA.assemble(index, path => {
    const v = JSON.parse(texts[path]);
    GH.data[path] = PB_DATA.text(v);
    return v;
  });
  GH.data['index.json'] = texts['index.json'];
  return D;
}
function ghDataChanges(D) {
  const { index, files } = PB_DATA.split(D),
    now = { 'index.json': PB_DATA.text(index) },
    out = [];
  for (const [path, v] of Object.entries(files)) now[path] = PB_DATA.text(v);
  for (const [path, text] of Object.entries(now))
    if (GH.data[path] !== text) out.push({ path: ghPath('data/' + path), text });
  for (const path of Object.keys(GH.data)) if (!(path in now)) out.push({ path: ghPath('data/' + path), gone: true });
  return out;
}
/* ---------- the Studio's server calls, answered from GitHub ---------- */
async function ghApi(path, opt = {}) {
  const [p, qs] = path.split('?'),
    q = new URLSearchParams(qs || ''),
    post = (opt.method || 'GET') === 'POST';
  if (!post) {
    if (p === 'gamedata') return ghReadData();
    if (p === 'rigs') {
      const R = ghJsJson(
        await gh(ghRepo(`contents/${ghPath('art/rigs.js')}?ref=${GH_CFG.branch}`), {}, true),
        'window.RIGS'
      );
      return R;
    }
    if (p === 'files') {
      if (!GH.tree) GH.tree = (await gh(ghRepo(`git/trees/${GH_CFG.branch}?recursive=1`))).tree;
      const pre = ghPath('art/' + (q.get('dir') || '').replace(/^\/|\/$/g, '')).replace(/\/$/, '') + '/';
      return GH.tree
        .filter(
          t =>
            t.type === 'blob' &&
            t.path.startsWith(pre) &&
            /\.(png|webp|jpg|svg)$/i.test(t.path) &&
            !t.path.includes('.backups')
        )
        .map(t => ({ path: t.path.slice(GH_CFG.game ? GH_CFG.game.length + 1 : 0), size: t.size, mtime: 0 }));
    }
    if (p === 'backups') return [];
    throw new Error('Unknown request.');
  }
  if (!GH.batch) throw new Error('Saving goes through “Propose changes”.');
  if (p === 'gamedata') {
    GH.batch.push(...ghDataChanges(JSON.parse(opt.body)));
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
    GH.batch.push(
      { path: ghPath('art/rigs.js'), text: GH_HEAD.rigs + 'window.RIGS=' + JSON.stringify(old) + ';\n' },
      { path: ghPath('art/next/rigs-next.js'), text: GH_HEAD.next + 'window.RIGS_NEXT=' + JSON.stringify(nxt) + ';\n' }
    );
    return { ok: true };
  }
  if (p === 'file') {
    const rel = q.get('path') || '';
    if (!/^art\/[\w\-./]+\.(png|webp)$/i.test(rel) || rel.includes('..')) throw new Error('Bad art path.');
    GH.batch.push({ path: ghPath(rel), blob: await opt.body.arrayBuffer() });
    return { ok: true };
  }
  if (p === 'restore')
    throw new Error(
      'On GitHub, earlier versions are in the repository’s history; ask the owner to roll a change back.'
    );
  throw new Error('Unknown request.');
}
/* everything saved in one go: a branch, one commit, a pull request */
async function ghPropose(summary) {
  const files = GH.batch;
  GH.batch = null;
  if (!files.length) return null;
  const base = await gh(ghRepo(`git/ref/heads/${GH_CFG.branch}`)),
    baseSha = base.object.sha,
    baseCommit = await gh(ghRepo(`git/commits/${baseSha}`));
  const tree = [];
  for (const f of files) {
    if (f.gone) {
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    const blob = await gh(ghRepo('git/blobs'), {
      method: 'POST',
      body: JSON.stringify({ content: f.blob ? b64(f.blob) : b64text(f.text), encoding: 'base64' }),
    });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const t = await gh(ghRepo('git/trees'), {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
  });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, ''),
    branch = `studio/${GH.login}-${stamp}`;
  const c = await gh(ghRepo('git/commits'), {
    method: 'POST',
    body: JSON.stringify({
      message: `Studio: ${summary}\n\nProposed by ${GH.login} in Pocket Billies Studio.`,
      tree: t.sha,
      parents: [baseSha],
    }),
  });
  await gh(ghRepo('git/refs'), { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/' + branch, sha: c.sha }) });
  const pr = await gh(ghRepo('pulls'), {
    method: 'POST',
    body: JSON.stringify({
      title: `Studio: ${summary}`,
      head: branch,
      base: GH_CFG.branch,
      body: `Proposed by @${GH.login} in Pocket Billies Studio.\n\nChanged files:\n${files.map(f => '- `' + f.path + '`').join('\n')}\n\nMerge this pull request to put the changes in the game; close it to turn them down.`,
    }),
  });
  return pr;
}
/* the Studio's own api() and saveAll() take this route when it runs from GitHub */
if (GH.on) {
  api = ghApi;
  const save0 = saveAll;
  saveAll = async function () {
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
    GH.batch = [];
    const t0 = toast;
    let pr = null,
      err = null;
    toast = (t, k) => {
      if (k === 'err') t0(t, k);
    };
    let none = false;
    try {
      await save0();
      none = !(GH.batch && GH.batch.length);
      if (!none) {
        $('#saveBtn').textContent = 'Sending…';
        pr = await ghPropose(what);
      }
    } catch (e) {
      err = e;
    } finally {
      toast = t0;
      GH.batch = null;
      $('#saveBtn').textContent = 'Propose changes';
      $('#saveBtn').disabled = false;
    }
    if (err) {
      ST.dirty = true;
      updTop();
      return toast('Couldn’t send the changes: ' + err.message, 'err');
    }
    if (pr) {
      await dialog(
        'Sent for approval',
        `<p>Your changes are pull request <b>#${pr.number}</b>. They go into the game when ${esc(GH_CFG.owner)} merges it. Until then the Studio (and the game) show the game as it is now.</p><p><a href="${esc(pr.html_url)}" target="_blank" rel="noopener">Open the pull request on GitHub</a></p>`,
        [{ l: 'OK', c: 'primary', v: 1 }]
      );
    } else if (none && !(ST.dirty || ST.rigsDirty || ST.artDirty.size))
      toast('Nothing to send: everything is as it is in the game.');
  };
  /* the Studio waits for sign-in before it loads anything */
  const boot0 = boot;
  removeEventListener('load', boot);
  addEventListener('load', async () => {
    await ghStart();
    boot0();
  });
}
