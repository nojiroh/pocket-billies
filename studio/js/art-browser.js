'use strict';
/* ================= POCKET BILLIES STUDIO · Art browser (Studio art track SA-1) =================
   Every picture under game/art in one place, in place of the old Art files tabs: the folders as the file list has
   them (never a list of names), with breadcrumbs; a grid of thumbnails (a size slider, drawn pixel for pixel on a
   checkerboard); one search box with tokens (dir:, w:, h:, unused, legacy; game/js/logic/art-search.js) shown as
   chips; and for the picture you pick: its path, size, frames, colours, what uses it (the reference index,
   game/js/logic/art-refs.js, from the data, the parked legacy data, the rigs, the model recipes and the code's own
   art paths in studio/art-code-refs.json), and Edit pixels (the shared pixel canvas: each stroke is a step of the
   Studio's undo), Replace, Download and Open in its editor. Ctrl K finds art files (find.js). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { atlasOverlay, iconReplace, provide, tileSetOpen } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { artURL } from '../../game/js/art.js';
import { EFFECT_FRAMES } from '../../game/js/walk-view.js';
import { escapeHtml } from './game-stand-ins.js';
import { offPalette, paletteColors, pixelKeyAction } from '../../game/js/logic/pixel-ops.js';
import {
  artFolderOf,
  artFolderView,
  artMadeBy,
  artMatch,
  artQueryEmpty,
  artQueryNeedsSize,
  artQueryParse,
  artQueryWithout,
  isArtPicture,
  pngSize,
} from '../../game/js/logic/art-search.js';
import { artRefIndex, artRefState } from '../../game/js/logic/art-refs.js';
import { stripOf } from '../../game/js/logic/frame-strips.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  api,
  ask,
  card,
  openSection,
  render,
  studioState,
  toast,
} from './studio-app.js';
import {
  drawPixelCanvas,
  pixelCanvas,
  pixelCanvasAct,
  pixelCanvasColor,
  pixelCanvasDeselect,
  pixelCanvasPanel,
  pixelCanvasPanelHTML,
  pixelCanvasToolsHTML,
} from './pixel-canvas.js';
import {
  atlasGet,
  atlasPath,
  downloadCanvas,
  fileToCanvas,
  loadImage,
  loadedAtlas,
  markArt,
  pickFile,
  svgDataUrl,
} from './sprites.js';
import { gameFilePath, githubMode } from './github.js';
import { legacyLoad, legacyView } from './legacy-view.js';
import { mountStripPlayers, stripPlayerHTML } from './strip-player.js';
/* eslint-disable no-func-assign */
expose({
  SHOWN: [() => SHOWN],
  SIZES_KEY: [() => SIZES_KEY],
  SIZE_KEY: [() => SIZE_KEY],
  artBrowser: [() => artBrowser],
  artBrowserShow: [() => artBrowserShow, v => ((artBrowserShow = v), provide({ artBrowserShow }))],
  artCodeRefsLoad: [() => artCodeRefsLoad, v => (artCodeRefsLoad = v)],
  artDetailNotes: [() => artDetailNotes, v => (artDetailNotes = v)],
  artEditorsFor: [() => artEditorsFor, v => (artEditorsFor = v)],
  artMadeByHTML: [() => artMadeByHTML, v => (artMadeByHTML = v)],
  artPaint: [() => artPaint, v => ((artPaint = v), provide({ artPaint }))],
  artPicSrc: [() => artPicSrc],
  artPictures: [() => artPictures],
  artRefs: [() => artRefs, v => (artRefs = v)],
  artSize: [() => artSize, v => (artSize = v)],
  artSizeRead: [() => artSizeRead, v => (artSizeRead = v)],
  artSizesRead: [() => artSizesRead, v => (artSizesRead = v)],
  artStripOf: [() => artStripOf],
  artTreeHas: [() => artTreeHas, v => (artTreeHas = v)],
  detailHTML: [() => detailHTML, v => (detailHTML = v)],
  editCardHTML: [() => editCardHTML, v => (editCardHTML = v)],
  fileOf: [() => fileOf],
  gridHTML: [() => gridHTML, v => (gridHTML = v)],
  listHTML: [() => listHTML, v => (listHTML = v)],
  metaOf: [() => metaOf],
  mountArtBrowser: [() => mountArtBrowser, v => (mountArtBrowser = v)],
  mountArtPixels: [() => mountArtPixels, v => (mountArtPixels = v)],
  rigRefs: [() => rigRefs, v => (rigRefs = v)],
  sizeKey: [() => sizeKey],
  sizeStore: [() => sizeStore, v => (sizeStore = v)],
  sizesRun: [() => sizesRun, v => (sizesRun = v)],
  sizesStored: [() => sizesStored, v => (sizesStored = v)],
  thumbHTML: [() => thumbHTML, v => (thumbHTML = v)],
  thumbSize: [() => thumbSize, v => (thumbSize = v)],
  thumbSizeKeep: [() => thumbSizeKeep, v => (thumbSizeKeep = v)],
  thumbSrc: [() => thumbSrc],
  treeFiles: [() => treeFiles, v => (treeFiles = v)],
});
/* eslint-enable no-func-assign */
provide({ artBrowserShow, artPaint });
/* to-module: end */
/* the browser's state: the folder, the search, the picked picture and the one being painted */
export const artBrowser = {
  at: '',
  q: '',
  sel: '',
  edit: '',
  /* SA-2a: the ground tile set (tile-set.js) shows in this section's place */
  tiles: false,
  /* SA-2b: the icon being edited (icon-editor.js), shown in this section's place; '' none */
  icon: '',
  /* SA-2b: the icon atlas's rectangles (atlas-editor.js) in this section's place */
  atlas: false,
  /* SA-2a: where Done goes back to when another editor opened the painter: { label, fn } */
  from: null,
  more: 0,
  /** @type {Map<string, { w: number, h: number }>} sizes read this session, by path */
  sizes: new Map(),
  /** @type {Map<string, Promise<void>>} */
  reading: new Map(),
  /** @type {{ refs: { p: string, at: string[] }[], recipes: { p: string, at: string[] }[] } | null} */
  code: null,
  /** @type {Map<string, any[]> | null} */
  ix: null,
  ixKey: '',
  pc: null,
  keep: {},
  tool: 'pen',
  color: '#000000',
};
const SHOWN = 240;
const SIZE_KEY = 'pb-art-thumb';
const SIZES_KEY = 'pb-art-sizes';

/* the thumbnail size: kept in this browser only */
function thumbSize() {
  try {
    const v = +localStorage.getItem(SIZE_KEY);
    if (v >= 32 && v <= 256) return v;
  } catch (e) {}
  return 96;
}
function thumbSizeKeep(v) {
  try {
    localStorage.setItem(SIZE_KEY, String(v));
  } catch (e) {}
}

/* the pictures of the file list (art/...) */
export const artPictures = () => (studioState.files || []).map(f => f.path).filter(isArtPicture);
provide({ artPictures }); /* to-module */
const fileOf = path => (studioState.files || []).find(f => f.path === path);

/* ---------- a picture's size: an edited one's canvas, else its PNG header (33 bytes) ---------- */
function sizesStored() {
  try {
    return JSON.parse(localStorage.getItem(SIZES_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}
/* kept by contents hash and path (a stand-in's tree may give every file one hash) */
const sizeKey = path => {
  const f = fileOf(path);
  return f && f.sha ? f.sha + ' ' + path : '';
};
function sizeStore(key, s) {
  if (!key) return;
  try {
    const all = sizesStored(),
      keys = Object.keys(all);
    if (keys.length > 6000) keys.slice(0, 1000).forEach(k => delete all[k]);
    all[key] = [s.w, s.h];
    localStorage.setItem(SIZES_KEY, JSON.stringify(all));
  } catch (e) {}
}
function artSize(path) {
  const c = studioState.artDirty.get(path);
  if (c) return { w: c.width, h: c.height };
  if (artBrowser.sizes.has(path)) return artBrowser.sizes.get(path);
  const k = sizeKey(path),
    s = k && sizesStored()[k];
  if (s) {
    const v = { w: s[0], h: s[1] };
    artBrowser.sizes.set(path, v);
    return v;
  }
  return null;
}
/* reads the size of a picture whose size isn't known: the first bytes of a PNG (a Range request), or the picture */
function artSizeRead(path) {
  if (artSize(path)) return Promise.resolve();
  if (artBrowser.reading.has(path)) return artBrowser.reading.get(path);
  const url = '../game/' + path,
    done = s => {
      if (!s) return;
      artBrowser.sizes.set(path, s);
      sizeStore(sizeKey(path), s);
    };
  const p = (async () => {
    if (/\.png$/i.test(path))
      try {
        const r = await fetch(url, { headers: { Range: 'bytes=0-32' } });
        if (r.ok) {
          const s = pngSize(new Uint8Array(await r.arrayBuffer()));
          if (s) return done(s);
        }
      } catch (e) {}
    try {
      const im = await loadImage(url);
      done({ w: im.naturalWidth, h: im.naturalHeight });
    } catch (e) {}
  })().finally(() => artBrowser.reading.delete(path));
  artBrowser.reading.set(path, p);
  return p;
}
/* reads many sizes, a few at a time, and redraws once in a while */
let sizesRun = null;
function artSizesRead(paths) {
  const todo = paths.filter(p => !artSize(p) && !artBrowser.reading.has(p));
  if (!todo.length || sizesRun) return;
  sizesRun = (async () => {
    let last = performance.now();
    const next = async () => {
      while (todo.length) {
        await artSizeRead(todo.shift());
        if (performance.now() - last > 700) {
          last = performance.now();
          if (studioState.sec === 'art') render();
        }
      }
    };
    await Promise.all(Array.from({ length: 8 }, next));
    sizesRun = null;
    if (studioState.sec === 'art') render();
  })();
}

/* ---------- what uses each picture (logic/art-refs.js) ---------- */
export async function artCodeRefsLoad() {
  if (artBrowser.code) return artBrowser.code;
  try {
    const r = await fetch('art-code-refs.json', { cache: 'no-cache' });
    artBrowser.code = r.ok ? await r.json() : { refs: [], recipes: [] };
  } catch (e) {
    artBrowser.code = { refs: [], recipes: [] };
  }
  return artBrowser.code;
}
/* a Billie's sheet: its rig's (sprites.js atlasPath), named by no data text */
function rigRefs() {
  const out = [];
  for (const L of studioState.D.lines || [])
    L.names.forEach((n, i) => {
      for (const v of ['front', 'back'])
        out.push({ path: atlasPath(L.id + i, v), ref: { kind: 'rig', from: 'lines', at: L.id + i, legacy: false } });
    });
  return out;
}
/* the index, made again when the data, the file list or the legacy data changed; null while its parts load */
export function artRefs() {
  if (!artBrowser.code) {
    artCodeRefsLoad().then(() => studioState.sec === 'art' && render());
    return null;
  }
  if (!legacyView.data && !legacyView.error) {
    const p = legacyLoad();
    if (p) p.then(() => studioState.sec === 'art' && render());
    return null;
  }
  const key = [studioState.ver, studioState.files.length, studioState.artDirty.size, !!legacyView.data].join('|');
  if (artBrowser.ix && artBrowser.ixKey === key && artBrowser.ixLast === studioState.last) return artBrowser.ix;
  const D = studioState.D,
    L = legacyView.data || {};
  const data = Object.entries(D).map(([from, value]) => ({ from, value }));
  for (const [k, v] of Object.entries(L))
    if (k !== 'mapIds' && k !== 'lines') data.push({ from: 'legacy ' + k, value: v, legacy: true });
  const paths = [...new Set([...artPictures(), ...studioState.artDirty.keys()])];
  artBrowser.ix = artRefIndex(paths, {
    data,
    code: artBrowser.code.refs || [],
    recipes: artBrowser.code.recipes || [],
    extra: rigRefs(),
    ids: {
      live: [...Object.keys(D.maps || {}), ...(D.locations || []).map(r => r.id).filter(Boolean)],
      legacy: [...(L.mapIds || []), ...(L.locations || []).map(r => r.id).filter(Boolean)],
    },
  });
  artBrowser.ixKey = key;
  artBrowser.ixLast = studioState.last;
  return artBrowser.ix;
}
const metaOf = (path, ix) => ({ ...(artSize(path) || {}), state: ix ? artRefState(ix.get(path)) : undefined });
/* SA-2a: a picture's frames, when the game animates it (logic/frame-strips.js), and the builder that draws it */
export const artStripOf = path =>
  stripOf(path, { effects: EFFECT_FRAMES, life: (studioState.D.scenery || {}).life || {} });
function artMadeByHTML(path) {
  const t = artMadeBy(path);
  return t
    ? `<p class="help warn">Drawn by <code>${escapeHtml(t)}</code>: running it again can draw over edits made here.</p>`
    : '';
}

/* ---------- open in its editor ---------- */
/* where a picture is edited, from what uses it and where it lives: [label, () => void] */
function artEditorsFor(path) {
  const ix = artBrowser.ix,
    refs = (ix && ix.get(path)) || [],
    D = studioState.D,
    out = [],
    add = (label, fn) => !out.some(o => o[0] === label) && out.push([label, fn]);
  for (const r of refs) {
    const top = r.at.split('/');
    if (r.kind === 'rig' || (r.from === 'lines' && r.kind === 'data')) {
      const L = (D.lines || []).find(l => r.at.startsWith(l.id));
      if (L) add('Billies', () => openSection('billionaires', { line: L.id, stage: +r.at.slice(L.id.length) || 0 }));
    } else if (r.from === 'scenery' && top[0] === 'props')
      add('Props', () => {
        openSection('props');
        if (ACTIONS.propsPick) ACTIONS.propsPick({ k: top[1] });
      });
    else if (r.from === 'scenery') add('Walk scenes', () => openSection('scenes'));
    else if (r.from === 'maps') add('Walk scenes', () => openSection('scenes', { scene: top[0] }));
    else if (r.from === 'wardrobe' && top[0] === 'items')
      add('Wardrobe', () => {
        openSection('wardrobe');
        if (ACTIONS.wdPick) ACTIONS.wdPick({ k: top[1] });
      });
    else if (r.from === 'wardrobe') add('Wardrobe', () => openSection('wardrobe'));
    else if (r.from === 'robots') {
      const P = top[0] === 'parts' && ((D.robots || {}).parts || {})[top[1]],
        G = top[0] === 'gems' && ((D.robots || {}).gems || {})[top[1]];
      add('Robots', () =>
        openSection('robots', P ? { rbKind: P.slot, rbId: top[1] } : G ? { rbKind: 'gem', rbId: top[1] } : {})
      );
    } else if (r.from === 'partKits' || r.from === 'kitBuilds') add('Art workbench', () => openSection('workbench'));
  }
  const f = artFolderOf(path);
  if (/^next\/billionaires(\/|$)/.test(f) && !out.length) {
    const name = path
      .split('/')
      .pop()
      .replace(/\.\w+$/, '');
    const L = (D.lines || []).find(l => l.names.some(n => n && n.toLowerCase() === name));
    if (L)
      add('Billies', () =>
        openSection('billionaires', { line: L.id, stage: L.names.findIndex(n => n.toLowerCase() === name) })
      );
  }
  const t47 = /^art\/next\/tiles\d*\/([\w-]+)_(\d+)\.png$/.exec(path);
  if (t47) add('Ground tile set', () => tileSetOpen(t47[1], +t47[2]));
  if (/^next\/parts(\/|$)/.test(f)) add('Art workbench', () => openSection('workbench'));
  if (/^scene\/(tiles|flags|far)(\/|$)/.test(f)) add('Walk scenes', () => openSection('scenes'));
  if (/^scene\/props(\/|$)/.test(f)) add('Props', () => openSection('props'));
  if (/^trainer(\/|$)/.test(f)) add('Wardrobe', () => openSection('wardrobe'));
  if (/^robots(\/|$)/.test(f)) add('Robots', () => openSection('robots'));
  return out;
}

/* ---------- the section ---------- */
const thumbSrc = path => {
  /* SA-2b: an unsaved SVG shows as its text */
  const t = studioState.textDirty.get(path);
  if (t) return svgDataUrl(t.text);
  const c = studioState.artDirty.get(path);
  if (!c) return `../game/${path}`;
  if (c._abUrl && c._abVer === c._ver) return c._abUrl;
  c._abUrl = c.toDataURL();
  c._abVer = c._ver;
  return c._abUrl;
};
function thumbHTML(path, ix) {
  const name = path.split('/').pop(),
    s = artSize(path),
    st = ix ? artRefState(ix.get(path)) : '',
    dirty = studioState.artDirty.has(path) || studioState.textDirty.has(path);
  return `<button class="ab-tile${path === artBrowser.sel ? ' on' : ''}${st === 'unused' ? ' ab-unused' : ''}" data-act="abPick" data-p="${escapeHtml(path)}" title="${escapeHtml(path)}"><span class="ab-thumb"><img src="${escapeHtml(thumbSrc(path))}" alt="" loading="lazy"></span><span class="ab-name">${escapeHtml(name)}</span><small>${s ? s.w + '×' + s.h : ''}${dirty ? ' · edited' : ''}${st === 'legacy' ? ' · legacy' : ''}</small></button>`;
}
function detailHTML(path, ix) {
  if (!path) return '<p class="help">Pick a picture to see what uses it.</p>';
  const f = fileOf(path),
    s = artSize(path),
    refs = ix ? ix.get(path) || [] : null,
    png = /\.png$/i.test(path),
    icon = /^art\/ui\/([\w-]+)\.svg$/.exec(path),
    eds = ix ? artEditorsFor(path) : [];
  const used =
    refs == null
      ? '<p class="help">Finding what uses it…</p>'
      : refs.length
        ? `<ul class="ab-refs">${refs
            .slice(0, 40)
            .map(
              r =>
                `<li><b>${escapeHtml(r.kind === 'code' ? 'code' : r.kind === 'recipe' ? 'model recipe' : r.kind === 'rig' ? 'Billie sheet' : r.from)}</b> ${escapeHtml(r.kind === 'code' ? r.from + ' (' + r.at + ')' : r.kind === 'recipe' ? r.from.replace(/^game\/art\//, '') : r.at)}${r.legacy ? ' <span class="chip">legacy</span>' : ''}</li>`
            )
            .join('')}${refs.length > 40 ? `<li class="help">and ${refs.length - 40} more</li>` : ''}</ul>`
        : '<p class="help">Nothing in the data or the code names it. That is a hint, not proof: the code builds some paths in ways the index can’t read.</p>';
  const strip = artStripOf(path),
    frames = strip
      ? `${strip.n} frames of ${strip.w}×${strip.h}`
      : artBrowser.frames && artBrowser.frames.path === path
        ? artBrowser.frames.text
        : '';
  const pal = artBrowser.pal && artBrowser.pal.path === path ? artBrowser.pal.text : '';
  return `<div class="ab-big"><img src="${escapeHtml(thumbSrc(path))}" alt=""></div>
  ${strip ? stripPlayerHTML(path, strip) : ''}
  <p class="mono ab-path">${escapeHtml(path)}</p>
  <p class="help">${s ? `${s.w}×${s.h} px` : 'size not read yet'}${f ? ` · ${(f.size / 1024).toFixed(1)} KB` : ''}${studioState.artDirty.has(path) || studioState.textDirty.has(path) ? ' · edited, not saved' : ''}${frames ? ' · ' + escapeHtml(frames) : ''}</p>
  ${pal ? `<p class="help">${escapeHtml(pal)}</p>` : ''}${artMadeByHTML(path)}
  <div class="seg-row ab-acts">${png ? `<button class="btn sm primary" data-act="abEdit" data-p="${escapeHtml(path)}">Edit pixels</button>` : ''}${icon ? `<button class="btn sm primary" data-act="icOpen" data-n="${escapeHtml(icon[1])}">Edit icon</button>` : ''}${path === 'art/icons/icons.png' ? '<button class="btn sm" data-act="atOpen">Edit the rectangles</button>' : ''}<button class="btn sm" data-act="abReplace" data-p="${escapeHtml(path)}">Replace…</button><button class="btn sm" data-act="abDownload" data-p="${escapeHtml(path)}">Download</button>${eds.map(([label], i) => `<button class="btn sm" data-act="abOpen" data-i="${i}" data-p="${escapeHtml(path)}">Open in ${escapeHtml(label)}</button>`).join('')}</div>
  <h4>Used by</h4>${used}`;
}
function gridHTML(ix) {
  const Q = artQueryParse(artBrowser.q),
    all = artPictures();
  if (artQueryEmpty(Q)) {
    const V = artFolderView(all, artBrowser.at);
    return {
      head: V.crumbs
        .map((c, i) =>
          i === V.crumbs.length - 1
            ? `<b>${escapeHtml(c.name)}</b>`
            : `<button class="btn sm subtle" data-act="abGo" data-at="${escapeHtml(c.at)}">${escapeHtml(c.name)}</button>`
        )
        .join('<span class="ab-sep">/</span>'),
      body:
        V.folders
          .map(
            F =>
              `<button class="ab-tile ab-folder" data-act="abGo" data-at="${escapeHtml(F.at)}"><span class="ab-thumb">▤</span><span class="ab-name">${escapeHtml(F.name)}</span><small>${F.count} picture${F.count === 1 ? '' : 's'}</small></button>`
          )
          .join('') + listHTML(V.files, ix),
      count: V.files.length,
    };
  }
  const inside = artBrowser.at ? all.filter(p => (artFolderOf(p) + '/').startsWith(artBrowser.at + '/')) : all;
  if ((Q.unused || Q.legacy) && !ix) return { head: 'Finding what uses each picture…', body: '', count: 0 };
  const hit = [],
    need = [];
  for (const p of inside) {
    const m = artMatch(p, metaOf(p, ix), Q);
    if (m === true) hit.push(p);
    else if (m === 'size') need.push(p);
  }
  if (artQueryNeedsSize(Q) && need.length) artSizesRead(need);
  return {
    head: `${hit.length} found${artBrowser.at ? ' in ' + escapeHtml(artBrowser.at) : ''}${need.length ? ` · reading ${need.length} sizes…` : ''}`,
    body: listHTML(hit, ix),
    count: hit.length,
  };
}
function listHTML(paths, ix) {
  const n = SHOWN * (1 + artBrowser.more);
  return (
    paths
      .slice(0, n)
      .map(p => thumbHTML(p, ix))
      .join('') +
    (paths.length > n
      ? `<button class="btn ab-more" data-act="abMore">Show ${Math.min(SHOWN, paths.length - n)} more of ${paths.length - n}</button>`
      : '')
  );
}
SECTIONS.art = () => {
  const Q = artQueryParse(artBrowser.q),
    ix = artRefs(),
    G = gridHTML(ix),
    sz = thumbSize();
  if (artBrowser.sel && !artSize(artBrowser.sel))
    artSizeRead(artBrowser.sel).then(() => studioState.sec === 'art' && render());
  afterRender(mountArtBrowser);
  if (artBrowser.edit) return `<div class="ed-col solo">${editCardHTML()}</div>`;
  return `<div class="ed-col solo"><div class="ed-head"><h2>Art browser</h2><button class="btn" data-act="artRefresh">Refresh list</button></div>
  <div class="ab-bar"><input type="search" id="abQ" class="ab-q" placeholder="Search: names, dir:scene/props, w:>32, h:16-64, unused, legacy" value="${escapeHtml(artBrowser.q)}" autocomplete="off" spellcheck="false">
  <label class="ab-size">Size <input type="range" id="abSize" min="32" max="256" step="8" value="${sz}"></label></div>
  ${Q.chips.length ? `<div class="seg-row ab-chips">${Q.chips.map((c, i) => `<button class="chip ab-chip" data-act="abChip" data-i="${i}" title="Take it off">${escapeHtml(c.text)} ✕</button>`).join('')}</div>` : ''}
  ${/^next\/tiles\d*$/.test(artBrowser.at) && artQueryEmpty(Q) ? '<div class="seg-row ab-note"><span class="help">The full-mode ground: twelve 32 px tiles a kind.</span><button class="btn sm primary" data-act="tsOpen">Open as a ground tile set</button></div>' : ''}
  <div class="ab-wrap"><div class="ab-main"><div class="ab-crumbs">${G.head}</div><div class="ab-grid" id="abGrid" style="--ab-size:${sz}px">${G.body || '<p class="help">Nothing here.</p>'}</div></div>
  <aside class="ab-side">${card('Picture', detailHTML(artBrowser.sel, ix))}</aside></div></div>`;
};
function mountArtBrowser() {
  const q = $('#abQ');
  if (q) {
    let t = 0;
    q.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        artBrowser.q = q.value;
        artBrowser.more = 0;
        render();
      }, 180);
    });
  }
  const s = $('#abSize');
  if (s)
    s.addEventListener('input', () => {
      const g = $('#abGrid');
      if (g) g.style.setProperty('--ab-size', s.value + 'px');
      thumbSizeKeep(+s.value);
    });
  if (artBrowser.edit) mountArtPixels();
  else artDetailNotes(artBrowser.sel);
  mountStripPlayers();
}
/* a file of game/ is in the repository's tree (the file list keeps pictures only; the tree has every file) */
let treeFiles = null;
function artTreeHas(path) {
  const T = githubMode.tree;
  if (!T) return false;
  if (!treeFiles || treeFiles.tree !== T) treeFiles = { tree: T, set: new Set(T.map(t => t.path)) };
  return treeFiles.set.has(gameFilePath(path));
}
/* frames (a sheet's layout beside it) and colours (against the game palette), worked out once for the picked one */
async function artDetailNotes(path) {
  if (!path || /\.svg$/i.test(path)) return;
  if (!(artBrowser.frames && artBrowser.frames.path === path)) {
    artBrowser.frames = { path, text: '' };
    const side = path.replace(/\.\w+$/, '.json');
    if (artTreeHas(side))
      try {
        const r = await fetch('../game/' + side, { cache: 'no-cache' });
        if (r.ok) {
          const j = await r.json(),
            n = Array.isArray(j.frames) ? j.frames.length : Array.isArray(j.pieces) ? j.pieces.length : 0;
          if (n)
            artBrowser.frames.text = `${n} ${Array.isArray(j.frames) ? 'frames' : 'pieces'} (${side.split('/').pop()})`;
        }
      } catch (e) {}
  }
  if (!(artBrowser.pal && artBrowser.pal.path === path)) {
    artBrowser.pal = { path, text: '' };
    try {
      const c = await atlasGet(path),
        im = c.getContext('2d').getImageData(0, 0, c.width, c.height),
        cols = new Set(),
        d = im.data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      const P = paletteColors(window.NW_PALETTE && window.NW_PALETTE.ramps),
        off = P.length ? offPalette(im, P).reduce((a, b) => a + b, 0) : 0;
      artBrowser.pal.text = `${cols.size} colours${P.length ? (off ? ` · ${off} pixels off the game palette` : ' · all on the game palette') : ''}`;
      if (!artSize(path)) artBrowser.sizes.set(path, { w: c.width, h: c.height });
    } catch (e) {}
  }
  if (studioState.sec === 'art' && artBrowser.sel === path && !artBrowser.edit) {
    const side = $('.ab-side .card-b');
    if (side) {
      side.innerHTML = detailHTML(path, artBrowser.ix);
      mountStripPlayers(side);
    }
  }
}

/* ---------- actions ---------- */
ACTIONS.abGo = d => {
  artBrowser.tiles = false;
  artBrowser.icon = '';
  artBrowser.atlas = false;
  artBrowser.from = null;
  artBrowser.at = d.at || '';
  artBrowser.more = 0;
  render();
};
ACTIONS.abPick = d => {
  artBrowser.sel = d.p;
  render();
};
ACTIONS.abMore = () => {
  artBrowser.more++;
  render();
};
ACTIONS.abChip = d => {
  const Q = artQueryParse(artBrowser.q);
  artBrowser.q = artQueryWithout(artBrowser.q, Q.chips[+d.i]);
  render();
};
ACTIONS.artRefresh = async () => {
  studioState.files = await api('files?dir=');
  render();
};
ACTIONS.abOpen = d => {
  const E = artEditorsFor(d.p)[+d.i];
  if (E) E[1]();
};
ACTIONS.abDownload = async d => {
  if (studioState.textDirty.has(d.p)) {
    const a = document.createElement('a');
    a.href = svgDataUrl(studioState.textDirty.get(d.p).text);
    a.download = d.p.split('/').pop();
    return a.click();
  }
  if (/\.png$/i.test(d.p) || studioState.artDirty.has(d.p))
    return downloadCanvas(await atlasGet(d.p), d.p.split('/').pop());
  const a = document.createElement('a');
  a.href = '../game/' + d.p;
  a.download = d.p.split('/').pop();
  a.click();
};
ACTIONS.abReplace = async d => {
  if (/\.svg$/i.test(d.p)) return iconReplace(d.p);
  const f = await pickFile('image/png,image/webp');
  if (!f) return;
  const c = await fileToCanvas(f);
  let old = null;
  try {
    old = await atlasGet(d.p);
  } catch (e) {}
  if (
    old &&
    (old.width !== c.width || old.height !== c.height) &&
    !(await ask(
      `The new image is ${c.width}×${c.height}; the old one is ${old.width}×${old.height}. Some art (atlases, textures) must keep its size. Replace anyway?`,
      'Replace'
    ))
  )
    return;
  markArt(d.p, c);
  artBrowser.pal = null;
  toast('Replaced in the Studio. Save to game to write it.');
  render();
};
/* Ctrl K: a file found opens here, picked, in its folder */
function artBrowserShow(path) {
  artBrowser.at = artFolderOf(path);
  artBrowser.q = '';
  artBrowser.sel = path;
  artBrowser.edit = '';
  artBrowser.tiles = false;
  artBrowser.icon = '';
  artBrowser.atlas = false;
  artBrowser.from = null;
  openSection('art');
}

/* ---------- Edit pixels: the shared pixel canvas on any PNG ---------- */
function editCardHTML() {
  const p = artBrowser.edit,
    strip = artStripOf(p);
  return card(
    `Edit pixels: ${escapeHtml(p.split('/').pop())}`,
    `<div class="sc-pe" id="abPe"><div class="sc-pe-bar">${pixelCanvasToolsHTML()}<span class="colw"><input type="color" id="abPeColor" value="${artBrowser.color}"></span><span class="grow"></span><button class="btn sm primary" data-act="abEditDone">${artBrowser.from ? 'Done, back to ' + escapeHtml(artBrowser.from.label) : 'Done'}</button></div>
  <div class="sc-pe-body"><div class="sc-pe-stage" id="abPeStage"></div><div class="sc-pe-side">${strip ? stripPlayerHTML(p, strip) : ''}${pixelCanvasPanelHTML()}<p class="help mono">${escapeHtml(p)}</p>${artMadeByHTML(p)}<p class="help">Each stroke is a step of the Studio’s undo (Ctrl Z). Save to game writes the picture.</p></div></div></div>`
  );
}
ACTIONS.abEdit = async d => {
  try {
    await atlasGet(d.p);
  } catch (e) {
    toast('Could not load ' + d.p, 'err');
    return;
  }
  artBrowser.edit = d.p;
  artBrowser.sel = d.p;
  artBrowser.from = null;
  render();
};
ACTIONS.abEditDone = () => {
  const back = artBrowser.from;
  artBrowser.edit = '';
  artBrowser.pc = null;
  artBrowser.pal = null;
  artBrowser.from = null;
  if (back) back.fn();
  else render();
};
/** SA-2a: another editor's Edit pixels: the painter on a picture (art/...), and Done goes back with `back`
 * ({ label, fn }) */
export async function artPaint(path, back = null) {
  try {
    await atlasGet(path);
  } catch (e) {
    toast('Could not load ' + path, 'err');
    return;
  }
  Object.assign(artBrowser, {
    tiles: false,
    icon: '',
    atlas: false,
    edit: path,
    sel: path,
    at: artFolderOf(path),
    q: '',
    from: back,
  });
  if (studioState.sec !== 'art') openSection('art');
  else render();
}
/** SA-2a: a picture's src for an <img>: the unsaved canvas when it has been edited, else the game's file
 * @param {string} rel a path under game/art (robots/vane.png) */
const artPicSrc = rel => (studioState.artDirty.has('art/' + rel) ? thumbSrc('art/' + rel) : artURL(rel));
provide({ artPicSrc }); /* to-module */
function mountArtPixels() {
  const st = $('#abPeStage');
  if (!st) return;
  const path = artBrowser.edit;
  const P = pixelCanvas(st, {
    get: () => loadedAtlas(path),
    path: () => path,
    /* SA-2b: the icon atlas's rectangles over its sheet */
    overlay: path === 'art/icons/icons.png' ? () => atlasOverlay() : undefined,
    tool: artBrowser.tool,
    color: artBrowser.color,
    changed: () => markArt(path, loadedAtlas(path)),
    toolChanged: P => (artBrowser.tool = P.tool),
    colorChanged: P => {
      artBrowser.color = P.color;
      const c = $('#abPeColor');
      if (c) c.value = P.color;
    },
    drawn: P => {
      artBrowser.keep = {
        zoom: P.zoom,
        showGrid: P.showGrid,
        symMode: P.symMode,
        symShift: P.symShift,
        lock: P.lock,
        showOff: P.showOff,
      };
    },
  });
  Object.assign(P, artBrowser.keep);
  artBrowser.pc = P;
  pixelCanvasPanel(P, $('#abPe'));
  drawPixelCanvas(P);
  const col = $('#abPeColor');
  col.addEventListener('input', () => pixelCanvasColor(P, col.value));
}
/* the painter's keys while the pointer is over it (as the ground tile painter's) */
document.addEventListener(
  'keydown',
  ev => {
    const pe = $('#abPe'),
      P = artBrowser.pc;
    if (!pe || !P || !P.cv.isConnected || !pe.matches(':hover') || $('#dlg').innerHTML) return;
    if (ev.target.closest('input,select,textarea')) return;
    const a = pixelKeyAction(ev);
    if (!a || a === 'undo' || a === 'redo' || a === 'onion') return;
    if (a === 'deselect' ? !pixelCanvasDeselect(P) : !pixelCanvasAct(P, a)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  },
  true
);
