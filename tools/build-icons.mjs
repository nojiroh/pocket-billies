// Perks track PK-2: pictures for Perks (PK-11: Bag items; later held items and boons) drawn as the UI icons are. A folder's
// grids, tools/art/icon-grids/<folder>.json, hold each picture's flat 34 x 34 front in the icon builder's letters
// (ICON_PALETTE; '.' empty; digits 1-4 are the light, mid, dark and ink of the one hue `mono` names for it, its
// letters then accents). Each front is shaded by iconBlockKeyed (game/js/logic/icon-block.js) and written by
// pixelsToSvg (svg-pixels.js) to game/art/<folder>/<id>.svg: a 36 x 36 SVG in the UI icons' look.
// Once written, the SVG is the source (the Studio's icon editor edits it), so an SVG on disk is never written over
// without --force. A grid is written only once the game data names its picture ("perks/<id>.svg"): grids drawn ahead
// of their Perks wait, so the unused-art gate stays green.
//   node tools/build-icons.mjs perks              # write the SVGs the data names and that aren't there yet
//   node tools/build-icons.mjs perks --force      # write them over (loses Studio edits)
//   node tools/build-icons.mjs perks --only=a,b   # just these ids
//   node tools/build-icons.mjs perks --check      # check the grids and SVGs, write nothing (exit 1 on a problem)
//   node tools/build-icons.mjs perks --sheet      # contact sheets, validation/icon-sheets/perks-{light,dark}.png
// The sheet needs Playwright for Node (the container's global one is found; NODE_PATH is not needed).
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ICON_FRONT, ICON_PALETTE, ICON_RAMPS, ICON_SIZE, iconBlockKeyed } from '../game/js/logic/icon-block.js';
import { ICON_DIRS, pixelsToSvg, svgProblem, svgToPixels } from '../game/js/logic/svg-pixels.js';
import { readGameData } from './data-files.mjs';

export const ROOT = join(import.meta.dirname, '..');
/** the folders a grid file may draw into (art/ui keeps its 51 icons; tools/test/ui-icons.test.mjs) */
export const ICON_FOLDERS = ICON_DIRS.filter(d => d !== 'ui');
/** two pictures whose filled shapes overlap this much (iconOverlap) read as one at 36 px */
export const ICON_SAME = 0.9;
const ID = /^[a-z][a-z0-9_]*$/;

/**
 * What is wrong with one grid ([] when fine): 34 rows of 34, known letters, digits only with a `mono` hue.
 * @param {string} id @param {unknown} rows @param {string} [hue] @returns {string[]}
 */
export function iconGridProblems(id, rows, hue) {
  const out = [];
  if (!ID.test(id)) out.push(`${id}: an id is lower case letters, digits and _`);
  if (hue && !(/** @type {Record<string, string[]>} */ (ICON_RAMPS)[hue]))
    out.push(`${id}: mono "${hue}" is not a hue of ICON_RAMPS (${Object.keys(ICON_RAMPS).join(', ')})`);
  if (!Array.isArray(rows) || rows.length !== ICON_FRONT) {
    out.push(`${id}: ${ICON_FRONT} rows, not ${Array.isArray(rows) ? rows.length : 'none'}`);
    return out;
  }
  rows.forEach((r, y) => {
    if (typeof r !== 'string' || r.length !== ICON_FRONT)
      return out.push(`${id} row ${y}: ${ICON_FRONT} letters, not ${typeof r === 'string' ? r.length : 'none'}`);
    for (const [x, ch] of [...r].entries()) {
      if (ch === '.' || ch in ICON_PALETTE) continue;
      if (/[1-4]/.test(ch) && hue) continue;
      out.push(
        `${id} row ${y}, column ${x}: "${ch}" is ${/[1-4]/.test(ch) ? 'a shade digit without a mono hue' : 'no colour letter'}`
      );
      break;
    }
  });
  if (!out.length && !rows.some(r => /[^.]/.test(r))) out.push(`${id}: nothing drawn`);
  return out;
}

/**
 * A grid shaded as a block and written as the icons' SVG text (families keyed as icon-block.test.mjs keys them: a
 * one-colour icon's digits are one block, each letter its own).
 * @param {string[]} rows @param {string} [hue] @returns {string}
 */
export function iconGridSvg(rows, hue = '') {
  const R = /** @type {Record<string, string[]>} */ (ICON_RAMPS)[hue];
  const front = rows.map(r => [...r].map(ch => (ch === '.' ? '' : ch)));
  const px = iconBlockKeyed(
    front,
    ch => (/\d/.test(ch) ? R[+ch - 1] : /** @type {Record<string, string>} */ (ICON_PALETTE)[ch]),
    ch => (/\d/.test(ch) ? 'mono' : ch)
  );
  const data = new Uint8ClampedArray(ICON_SIZE * ICON_SIZE * 4);
  px.forEach((row, y) =>
    row.forEach((h, x) => {
      if (h) data.set([1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).concat(255), (y * ICON_SIZE + x) * 4);
    })
  );
  return pixelsToSvg(data, ICON_SIZE, ICON_SIZE);
}

/** an icon's filled shape (1 where a pixel is drawn), or null when its SVG isn't in the pixel format
 * @param {string} svg @returns {Uint8Array | null} */
export function iconSilhouette(svg) {
  const p = svgToPixels(svg);
  if ('error' in p) return null;
  const out = new Uint8Array(p.w * p.h);
  for (let i = 0; i < out.length; i++) out[i] = p.data[i * 4 + 3] ? 1 : 0;
  return out;
}

/** how much two shapes overlap: the pixels both fill over the pixels either fills (1 = the same shape)
 * @param {Uint8Array} a @param {Uint8Array} b */
export function iconOverlap(a, b) {
  let both = 0,
    either = 0;
  for (let i = 0; i < a.length; i++) {
    both += a[i] & b[i];
    either += a[i] | b[i];
  }
  return either ? both / either : 1;
}

/** a folder's grid file @param {string} folder @param {string} [root] */
export function readIconGrids(folder, root = ROOT) {
  const f = join(root, 'tools/art/icon-grids', folder + '.json');
  const G = JSON.parse(readFileSync(f, 'utf8'));
  return { file: f, about: String(G.about || ''), mono: G.mono || {}, icons: G.icons || {} };
}

/** the texts in the game data (every data file, assembled as the game reads it): a picture is named when one of
 * them is its path ('perks/x.svg') @returns {Set<string>} */
export function dataArtPaths() {
  const out = new Set(),
    walk = (/** @type {unknown} */ v) => {
      if (typeof v === 'string') out.add(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
  walk(readGameData());
  return out;
}

/**
 * Checks a folder (its grids, the SVGs written from them, the silhouettes) and says what writing would do.
 * @param {{ folder: string, root?: string, only?: string[], force?: boolean, named?: Set<string> }} o
 * @returns {{ problems: string[], notes: string[], write: { id: string, path: string, svg: string }[], waiting: string[] }}
 */
export function planIcons({ folder, root = ROOT, only, force = false, named }) {
  const problems = [],
    notes = [],
    write = [],
    waiting = [];
  if (!ICON_FOLDERS.includes(folder)) {
    problems.push(`${folder}: not an icon folder (${ICON_FOLDERS.join(', ')})`);
    return { problems, notes, write, waiting };
  }
  const G = readIconGrids(folder, root),
    names = named || dataArtPaths();
  for (const k of Object.keys(G.mono)) if (!G.icons[k]) problems.push(`mono names ${k}, which has no grid`);
  /** @type {[string, Uint8Array][]} */
  const shapes = [];
  for (const [id, rows] of Object.entries(G.icons)) {
    if (only && !only.includes(id)) continue;
    const bad = iconGridProblems(id, rows, G.mono[id]);
    if (bad.length) {
      problems.push(...bad);
      continue;
    }
    const svg = iconGridSvg(rows, G.mono[id]),
      sp = svgProblem(svg);
    if (sp) problems.push(`${id}: the shaded SVG fails svgProblem: ${sp}`);
    const rel = `${folder}/${id}.svg`,
      path = join(root, 'game/art', rel),
      there = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (there != null) {
      const p = svgProblem(there);
      if (p) problems.push(`art/${rel}: ${p}`);
      if (there !== svg) notes.push(`art/${rel} differs from its grid (edited in the Studio: the SVG is the source)`);
    }
    shapes.push([id, iconSilhouette(there != null && !svgProblem(there) ? there : svg) || new Uint8Array(0)]);
    if (!names.has(rel)) waiting.push(id);
    else if (there == null || (force && there !== svg)) write.push({ id, path, svg });
  }
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      const o = iconOverlap(shapes[i][1], shapes[j][1]);
      if (o >= ICON_SAME)
        problems.push(
          `${shapes[i][0]} and ${shapes[j][0]}: their shapes overlap ${Math.round(o * 100)}% (they read as one picture)`
        );
    }
  return { problems, notes, write, waiting };
}

/* ---------- the contact sheet ---------- */
const SHEET_THEME = {
  light: { ground: '#F4EFE0', surface: '#FFFBF0', text: '#22301F', text2: '#55634F', line: '#22301F2E' },
  dark: { ground: '#17261E', surface: '#1D2E25', text: '#EEF2E2', text2: '#AEB9A4', line: '#FFFFFF24' },
};
/* UI-10's rarity ladder (UI-14a/b put it in the game) */
const SHEET_RARITY = { common: '#A5ACB2', uncommon: '#4AB962', rare: '#629BFF', fine: '#F77036' };
const esc = (/** @type {string} */ s) => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

/** a sheet's page: cards at 72 px (2x), then rows at 36 and 18 px
 * @param {{ folder: string, mode: 'light' | 'dark', items: { id: string, svg: string, name: string, sub: string, d: string, rarity?: string, waiting?: boolean }[] }} o */
export function iconSheetHTML({ folder, mode, items }) {
  const T = SHEET_THEME[mode],
    url = (/** @type {string} */ s) => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64'),
    img = (/** @type {string} */ s, /** @type {number} */ n) =>
      `<img src="${url(s)}" width="${n}" height="${n}" style="image-rendering:pixelated" alt="">`;
  const cards = items
    .map(
      it => `<div class="card" style="border-color:${(it.rarity && SHEET_RARITY[it.rarity]) || T.line}">
  <div class="art">${img(it.svg, 72)}</div><b>${esc(it.name)}</b>
  <small style="color:${(it.rarity && SHEET_RARITY[it.rarity]) || T.text2}">${esc(it.sub)}${it.waiting ? ' · waits for its wave' : ''}</small>
  <p>${esc(it.d)}</p></div>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:16px;width:${4 * 180 + 3 * 10}px;background:${T.ground};color:${T.text};font:13px/1.35 system-ui,sans-serif}
h1{font-size:18px;margin:0 0 4px}.sub{color:${T.text2};margin:0 0 12px}
.grid{display:grid;grid-template-columns:repeat(4,180px);gap:10px}
.card{background:${T.surface};border:2px solid;border-radius:8px;padding:8px}
.art{display:flex;justify-content:center;align-items:center;height:88px;border-radius:6px;background:${T.ground};margin-bottom:6px}
.card b{display:block;font-size:14px}.card small{display:block;font-weight:600}.card p{margin:4px 0 0;color:${T.text2};font-size:12px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px;padding:8px;background:${T.surface};border-radius:8px}
</style></head><body><h1>art/${esc(folder)} · ${mode}</h1>
<p class="sub">tools/build-icons.mjs --sheet: each picture on a card at 72 px (2x), then rows at 36 px and 18 px.</p>
<div class="grid">${cards}</div>
<div class="row">${items.map(it => img(it.svg, 36)).join('')}</div>
<div class="row">${items.map(it => img(it.svg, 18)).join('')}</div></body></html>`;
}

/** a folder's data as the sheet names it: { name, sub, d, rarity } by id (perks.json's Perks, items.json's items) */
function sheetNames(/** @type {string} */ folder, root = ROOT) {
  const RAR = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', mythical: 'Mythical', fine: 'Fine Print' },
    read = (/** @type {string} */ f) => JSON.parse(readFileSync(join(root, 'game/data', f), 'utf8')),
    /** @type {Record<string, { name: string, sub: string, d: string, rarity: string }>} */
    out = {};
  if (folder === 'perks')
    for (const [id, P] of Object.entries(read('perks.json')))
      out[id] = { name: P.name, sub: `${RAR[P.rarity] || P.rarity} · Perk`, d: P.d, rarity: P.rarity };
  /* PK-11: the Bag's items (a held item with its tier) */
  if (folder === 'items')
    for (const [id, I] of Object.entries(read('items.json')))
      out[id] = {
        name: I.n,
        sub: I.hold ? `${RAR[I.rarity] || I.rarity} · Held item` : 'Bag item',
        d: I.d,
        rarity: I.hold ? I.rarity : '',
      };
  return out;
}

/** what a sheet shows for each grid: its SVG on disk when there is one, else the grid shaded */
function sheetItems(/** @type {string} */ folder, root = ROOT) {
  const G = readIconGrids(folder, root),
    names = dataArtPaths(),
    data = sheetNames(folder, root);
  return Object.entries(G.icons).map(([id, rows]) => {
    const path = join(root, 'game/art', folder, id + '.svg'),
      svg = existsSync(path) ? readFileSync(path, 'utf8') : iconGridSvg(rows, G.mono[id]),
      P = data[id];
    return {
      id,
      svg,
      name: P ? P.name : id.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()),
      sub: P ? P.sub : 'Drawn ahead',
      d: P ? P.d : '',
      rarity: P ? P.rarity : '',
      waiting: !names.has(`${folder}/${id}.svg`),
    };
  });
}

/** the container's Playwright for Node: a local one, else the global one */
function playwright() {
  const req = createRequire(import.meta.url);
  try {
    return req('playwright');
  } catch (e) {
    const g = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return req(join(g, 'playwright'));
  }
}

/** renders validation/icon-sheets/<folder>-{light,dark}.png @param {string} folder */
export async function writeIconSheets(folder, root = ROOT) {
  const items = sheetItems(folder, root),
    dir = join(root, 'validation/icon-sheets');
  mkdirSync(dir, { recursive: true });
  const { chromium } = playwright(),
    browser = await chromium.launch(),
    out = [];
  try {
    for (const mode of /** @type {const} */ (['light', 'dark'])) {
      const page = await browser.newPage({ viewport: { width: 4 * 180 + 3 * 10 + 32, height: 400 } });
      await page.setContent(iconSheetHTML({ folder, mode, items }));
      /* the page's own pictures, loaded (this runs in the browser) */
      await page.waitForFunction(() => [...globalThis.document.images].every(i => i.complete));
      const f = join(dir, `${folder}-${mode}.png`);
      await page.screenshot({ path: f, fullPage: true });
      out.push(f);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2),
    folder = args.find(a => !a.startsWith('--')),
    flag = (/** @type {string} */ n) => args.includes('--' + n),
    onlyArg = args.find(a => a.startsWith('--only=')),
    only = onlyArg ? onlyArg.slice(7).split(',').filter(Boolean) : undefined;
  if (!folder) {
    console.log(`Usage: node tools/build-icons.mjs <${ICON_FOLDERS.join('|')}> [--check] [--force] [--only=a,b] [--sheet]`);
    process.exit(2);
  }
  const P = planIcons({ folder, only, force: flag('force') });
  for (const n of P.notes) console.log('  note: ' + n);
  if (P.waiting.length) console.log(`  waiting (no data names them yet): ${P.waiting.join(', ')}`);
  if (P.problems.length) {
    for (const p of P.problems) console.log('  PROBLEM: ' + p);
    console.log(`${P.problems.length} problem(s) in tools/art/icon-grids/${folder}.json`);
    process.exit(1);
  }
  if (flag('check')) {
    if (P.write.length) console.log(`  not written yet: ${P.write.map(w => w.id).join(', ')}`);
    console.log(`art/${folder}: the grids are fine`);
  } else {
    mkdirSync(join(ROOT, 'game/art', folder), { recursive: true });
    for (const w of P.write) writeFileSync(w.path, w.svg);
    console.log(`art/${folder}: ${P.write.length} written${P.write.length ? ': ' + P.write.map(w => w.id).join(', ') : ''}`);
    if (!flag('force') && P.notes.length) console.log('  (an SVG on disk is never written over without --force)');
  }
  if (flag('sheet')) for (const f of await writeIconSheets(folder)) console.log('  sheet: ' + f);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) await main();
