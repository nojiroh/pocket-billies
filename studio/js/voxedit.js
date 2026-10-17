'use strict';
/* ================= POCKET BILLIES STUDIO · voxel prop builder (v43) =================
   A prop's voxel model is a list of layers: shapes (box, cylinder, sphere, cone, barrel) placed in metres with a
   colour and a texture, raw voxels imported from a MagicaVoxel .vox, and picture layers (a 2D sprite set in the
   model: a sign's face, a flag, a painted front). Everything is edited here with sliders and shows at once on the
   prop editor's turntable, drawn by the game's own renderer. The model lives in the prop's catalogue entry
   (scenery.props.<key>.vox), so it saves with the game data; tools/build-vox-props.py wrote the first sixty as files
   and the game reads either. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/bridge.js';
import {
  ACTS,
  ST,
  ask,
  changed,
  commit,
  fChk,
  fColor,
  fNum,
  fRange,
  fSel,
  fText,
  grid,
  render,
  toast,
} from './core.js';
import { fileToCanvas, markArt, pickFile } from './sprites.js';
import { SCN, scD } from './scenes.js';
import { pedM } from './propedit.js';
/* eslint-disable no-func-assign */
expose({
  VXE: [() => VXE],
  VXE_KINDS: [() => VXE_KINDS],
  pedVoxHTML: [() => pedVoxHTML, v => (pedVoxHTML = v)],
  vxeBump: [() => vxeBump, v => (vxeBump = v)],
  vxeMainColour: [() => vxeMainColour, v => (vxeMainColour = v)],
  vxeOwn: [() => vxeOwn, v => (vxeOwn = v)],
  vxeRec: [() => vxeRec, v => (vxeRec = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const VXE = { sel: null };
const VXE_KINDS = [
  ['box', 'Box'],
  ['cyl', 'Cylinder'],
  ['sphere', 'Sphere'],
  ['cone', 'Cone'],
  ['barrel', 'Barrel'],
  ['img', 'Picture'],
  ['raw', 'Imported voxels'],
];
function vxeRec(M) {
  if (!M || !M.vox) return null;
  if (typeof M.vox === 'object') return M.vox;
  const r = typeof voxRecipe === 'function' ? voxRecipe(M.vox) : null;
  return r;
}
/* the recipe is edited in place: a file-based one is pulled into the catalogue entry first */
function vxeOwn(M) {
  if (typeof M.vox === 'string') {
    const r = vxeRec(M);
    if (!r) return null;
    M.voxFile = M.vox;
    M.vox = JSON.parse(JSON.stringify(r));
  }
  return M.vox;
}
function vxeBump(M) {
  M.voxV = (M.voxV || 0) + 1;
  if (typeof voxInvalidate === 'function') voxInvalidate('inline:' + SCN.ped + '#' + (M.voxV - 1));
  changed();
  commit(true);
}
function pedVoxHTML(k) {
  const M = scD().props[k],
    b = `scenery.props.${k}.vox`;
  if (!M || M.build) return '';
  const rec = vxeRec(M);
  const head = `<h4>3D model</h4>`;
  if (!M.vox)
    return `${head}<p class="help">Give this prop a real 3D body: shapes you place with sliders (drawn as low-poly painted with the buildings’ 32 px textures, or as voxels one to a pixel of the art with Engine › World › Props as low-poly off), voxels imported from MagicaVoxel, and pictures set in the model. With the Voxel props dial on, the game draws the model instead of the picture, cel-shaded in the scene's light; the picture stays for the map, the Studio lists and the dial off.</p>
  <div class="seg-row"><button class="btn sm" data-act="vxeNew">Start a model from the picture</button><button class="btn sm subtle" data-act="vxeImport">Import a .vox</button></div>`;
  if (!rec) {
    setTimeout(() => {
      if (SCN.ped === k && vxeRec(M)) render();
    }, 400);
    return `${head}<p class="help">Loading ${esc(String(M.vox))}…</p>`;
  }
  if (rec.kind === 'mesh')
    return `<h4>3D model</h4><p class="help">A low-poly model painted with the buildings’ 32 px textures${rec.about ? ' (' + esc(rec.about) + ')' : ''}. A tool makes its shape, so it isn’t edited here; the turntable shows it as the game draws it.</p>`;
  if (typeof M.vox === 'string') vxeOwn(M); /* edited in the catalogue entry from here on */
  const L = rec.layers || [],
    names = Object.fromEntries(VXE_KINDS),
    tex = typeof VOX_TEXTURES !== 'undefined' ? VOX_TEXTURES : [['plain', 'Plain']];
  const rows = L.map((l, i) => {
    const p = `${b}.layers.${i}`,
      on = VXE.sel === i,
      kind = l.k || 'box';
    const title = `<div class="vxe-lh"><b>${i + 1}. ${esc(l.name || names[kind] || kind)}</b><small>${esc(names[kind] || kind)}</small><span class="grow"></span>
   <button class="btn sm subtle" data-act="vxeSel" data-i="${i}">${on ? 'Close' : 'Edit'}</button><button class="btn sm subtle" data-act="vxeMove" data-i="${i}" data-d="-1" title="Up">↑</button><button class="btn sm subtle" data-act="vxeMove" data-i="${i}" data-d="1" title="Down">↓</button><button class="btn sm subtle" data-act="vxeDup" data-i="${i}" title="Duplicate">⧉</button><button class="btn sm danger subtle" data-act="vxeDel" data-i="${i}">Remove</button></div>`;
    if (!on) return `<div class="vxe-layer ${l.hide ? 'off' : ''}">${title}</div>`;
    const pos = `${fRange('Across (m)', `${p}.x`, { min: -3, max: 3, step: 0.02, def: 0 })}${fRange('Depth (m, + is behind)', `${p}.y`, { min: -3, max: 3, step: 0.02, def: 0 })}${fRange('Up (m)', `${p}.z`, { min: 0, max: 6, step: 0.02, def: 0 })}`;
    let body = '';
    if (kind === 'img')
      body = `${grid(
        fText('Picture', `${p}.img`, { help: 'A path under art/, e.g. scene/props/sign_face.png' }),
        fRange('Size (metres per 34 px)', `${p}.s`, { min: 0.1, max: 3, step: 0.02, def: 1 }),
        fSel(
          'Facing',
          `${p}.face`,
          [
            ['fixed', 'Stays put (faces the camera at rest)'],
            ['billboard', 'Turns to face the camera'],
          ],
          { opt: 1 }
        ),
        fChk('Mirrored', `${p}.flip`, { num: 1 })
      )}<div class="grid">${pos}</div><div class="seg-row"><button class="btn sm subtle" data-act="vxeImgPick" data-i="${i}">Pick a PNG…</button></div>`;
    else if (kind === 'raw')
      body = `<p class="help">${esc(String(l.n || '?'))} voxels imported from ${esc(l.src || 'a .vox')}. Move it with the sliders; its colours are its own.</p><div class="grid">${pos}</div>`;
    else {
      const size =
        kind === 'box'
          ? `${fRange('Width (m)', `${p}.w`, { min: 0.05, max: 6, step: 0.02, def: 0.5 })}${fRange('Depth (m)', `${p}.d`, { min: 0.05, max: 6, step: 0.02, def: 0.5 })}${fRange('Height (m)', `${p}.h`, { min: 0.05, max: 6, step: 0.02, def: 0.5 })}`
          : kind === 'sphere'
            ? fRange('Radius (m)', `${p}.r`, { min: 0.05, max: 3, step: 0.02, def: 0.3 })
            : `${fRange('Radius (m)', `${p}.r`, { min: 0.03, max: 3, step: 0.01, def: 0.3 })}${fNum('Depth radius (m)', `${p}.ry`, { opt: 1, min: 0.03, max: 3, step: 0.01, help: 'Empty: round. Set it for an oval, or a wheel seen from the side.' })}${fRange('Height (m)', `${p}.h`, { min: 0.05, max: 6, step: 0.02, def: 0.5 })}${kind === 'cone' ? fRange('Radius at the top (m)', `${p}.r1`, { min: 0, max: 3, step: 0.01, def: 0 }) : ''}${kind === 'barrel' ? fRange('Bulge', `${p}.bulge`, { min: 0, max: 0.4, step: 0.01, def: 0.15 }) : ''}`;
      body = `<div class="grid">${fSel(
        'Shape',
        `${p}.k`,
        VXE_KINDS.filter(q => !['img', 'raw'].includes(q[0]))
      )}${fText('Name', `${p}.name`, { opt: 1 })}${fColor('Colour', `${p}.col`)}${fSel('Texture', `${p}.tex`, tex, { opt: 1 })}${fChk('Hidden', `${p}.hide`, { num: 1 })}</div><div class="grid">${pos}</div><div class="grid">${size}</div>`;
    }
    /* alpha 0.4: a part that turns (a propeller, a windmill's sails, a wheel): about which way, through which point, how fast */
    if (kind !== 'img') {
      const sp = l.spin;
      body +=
        `<div class="seg-row"><button class="btn sm ${sp ? '' : 'subtle'}" data-act="vxeSpin" data-i="${i}">${sp ? 'It turns ✓' : 'Make it turn'}</button></div>` +
        (sp
          ? `<div class="grid">${fSel('Turns about', `${p}.spin.axis`, [
              ['x', 'Across (left–right)'],
              ['y', 'Depth (front–back)'],
              ['z', 'Up (like a carousel)'],
            ])}${fRange('Turns a second', `${p}.spin.rps`, { min: -4, max: 4, step: 0.1, def: 1.5 })}${fRange('Pivot across (m)', `${p}.spin.x`, { min: -3, max: 3, step: 0.02, def: 0 })}${fRange('Pivot depth (m)', `${p}.spin.y`, { min: -3, max: 3, step: 0.02, def: 0 })}${fRange('Pivot up (m)', `${p}.spin.z`, { min: 0, max: 6, step: 0.02, def: 0 })}</div>`
          : '');
    }
    return `<div class="vxe-layer on ${l.hide ? 'off' : ''}">${title}${body}</div>`;
  }).join('');
  return `${head}<p class="help">${L.length} layer${L.length === 1 ? '' : 's'}: low-poly with the buildings’ 32 px textures (wood is planks, stone is stone blocks, hay is thatch…), or voxels one to a pixel of the art with Props as low-poly off. Across is left–right, depth is toward the back, up is from the ground at the prop's base point. Everything shows on the turntable as you drag.</p>
  ${rows}<div class="seg-row vxe-add"><span class="help">Add:</span>${['box', 'cyl', 'sphere', 'cone', 'barrel'].map(q => `<button class="btn sm" data-act="vxeAdd" data-k="${q}">+ ${names[q]}</button>`).join('')}<button class="btn sm" data-act="vxeAdd" data-k="img">+ Picture</button><button class="btn sm subtle" data-act="vxeImport">Import a .vox…</button></div>
  <div class="seg-row"><button class="btn sm subtle" data-act="vxeExport">Download as .json</button><button class="btn sm subtle danger" data-act="vxeOff">Remove the model</button></div>`;
}
/* a first model: a box the size of the picture, a third as deep */
ACTS.vxeNew = () => {
  const M = pedM();
  if (!M) return;
  const im = dioImg(M.img),
    ppu = scD().ppu || 34,
    w = im ? (im.naturalWidth || im.width) / ppu : 1,
    h = im ? (im.naturalHeight || im.height) / ppu : 1;
  M.vox = {
    vpm: 32,
    layers: [
      {
        k: 'box',
        name: 'body',
        x: 0,
        y: 0,
        z: 0,
        w: +w.toFixed(2),
        d: +Math.max(0.2, w * 0.35).toFixed(2),
        h: +h.toFixed(2),
        col: vxeMainColour(M) || '#A08060',
        tex: 'plain',
      },
    ],
  };
  VXE.sel = 0;
  vxeBump(M);
  render();
};
function vxeMainColour(M) {
  try {
    const im = dioImg(M.img);
    if (!im) return null;
    const c = cnv(8, 8),
      x = c.getContext('2d');
    x.drawImage(im, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i + 3] > 100) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
    if (!n) return null;
    const h = v =>
      Math.round(v / n)
        .toString(16)
        .padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  } catch (e) {
    return null;
  }
}
ACTS.vxeAdd = d => {
  const M = pedM(),
    rec = vxeOwn(M);
  if (!rec) return;
  const L = rec.layers || (rec.layers = []),
    top = L.reduce((m, l) => Math.max(m, (l.z || 0) + (l.h || (l.r ? 2 * l.r : 0) || 0)), 0),
    k = d.k;
  const base = {
    box: { k: 'box', x: 0, y: 0, z: top, w: 0.5, d: 0.5, h: 0.5 },
    cyl: { k: 'cyl', x: 0, y: 0, z: top, r: 0.25, h: 0.5 },
    sphere: { k: 'sphere', x: 0, y: 0, z: top, r: 0.25 },
    cone: { k: 'cone', x: 0, y: 0, z: top, r: 0.3, r1: 0, h: 0.5 },
    barrel: { k: 'barrel', x: 0, y: 0, z: top, r: 0.3, h: 0.8, bulge: 0.15 },
    img: { k: 'img', img: M.img, x: 0, y: -0.01, z: 0, s: 1, face: 'fixed' },
  }[k];
  if (!base) return;
  if (k !== 'img') {
    base.col = (L.find(l => l.col) || {}).col || '#A08060';
    base.tex = 'plain';
  }
  L.push(base);
  VXE.sel = L.length - 1;
  vxeBump(M);
  render();
};
ACTS.vxeSel = d => {
  VXE.sel = VXE.sel === +d.i ? null : +d.i;
  render();
};
ACTS.vxeMove = d => {
  const M = pedM(),
    rec = vxeOwn(M);
  if (!rec) return;
  const i = +d.i,
    j = i + +d.d;
  if (j < 0 || j >= rec.layers.length) return;
  [rec.layers[i], rec.layers[j]] = [rec.layers[j], rec.layers[i]];
  if (VXE.sel === i) VXE.sel = j;
  vxeBump(M);
  render();
};
ACTS.vxeDup = d => {
  const M = pedM(),
    rec = vxeOwn(M);
  if (!rec) return;
  const i = +d.i,
    c = JSON.parse(JSON.stringify(rec.layers[i]));
  if (c.k !== 'img' && c.k !== 'raw') c.x = +((c.x || 0) + 0.1).toFixed(2);
  rec.layers.splice(i + 1, 0, c);
  VXE.sel = i + 1;
  vxeBump(M);
  render();
};
ACTS.vxeDel = d => {
  const M = pedM(),
    rec = vxeOwn(M);
  if (!rec) return;
  rec.layers.splice(+d.i, 1);
  VXE.sel = null;
  vxeBump(M);
  render();
};
ACTS.vxeOff = async () => {
  const M = pedM();
  if (
    !M ||
    !(await ask(
      'Draw this prop as its picture again? The model is removed from the game data (a file written by tools/build-vox-props.py stays on disk).',
      'Remove'
    ))
  )
    return;
  delete M.vox;
  delete M.voxV;
  VXE.sel = null;
  changed();
  commit(true);
  render();
};
ACTS.vxeExport = () => {
  const M = pedM(),
    rec = vxeRec(M);
  if (!rec) return;
  const b = new Blob([JSON.stringify(rec)], { type: 'application/json' }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `${SCN.ped}.json`;
  a.click();
};
ACTS.vxeImgPick = async d => {
  const M = pedM(),
    rec = vxeOwn(M),
    k = SCN.ped;
  if (!rec) return;
  const f = await pickFile('image/png');
  if (!f) return;
  const c = await fileToCanvas(f);
  if (c.width > 400 || c.height > 400) return toast('Keep pictures under 400×400 pixels.', 'err');
  let n = 1;
  while (ST.artDirty.has(`art/scene/props/${k}_vox${n}.png`) || dioImg(`scene/props/${k}_vox${n}.png`)) n++;
  const path = `scene/props/${k}_vox${n}.png`;
  markArt('art/' + path, c);
  rec.layers[+d.i].img = path;
  vxeBump(M);
  render();
};
/* MagicaVoxel import: SIZE + XYZI + RGBA chunks of the first model; the voxels become one raw layer, centred on the base point */
ACTS.vxeImport = async () => {
  const M = pedM();
  if (!M) return;
  const f = await pickFile('.vox');
  if (!f) return;
  const buf = new Uint8Array(await f.arrayBuffer()),
    dv = new DataView(buf.buffer);
  if (String.fromCharCode(...buf.slice(0, 4)) !== 'VOX ') return toast('That is not a .vox file.', 'err');
  let i = 8,
    size = null,
    xyzi = null,
    pal = null;
  while (i + 12 <= buf.length) {
    const tag = String.fromCharCode(...buf.slice(i, i + 4)),
      n = dv.getInt32(i + 4, true),
      body = i + 12;
    if (tag === 'SIZE' && !size)
      size = [dv.getInt32(body, true), dv.getInt32(body + 4, true), dv.getInt32(body + 8, true)];
    else if (tag === 'XYZI' && !xyzi) {
      const cnt = dv.getInt32(body, true);
      xyzi = [];
      for (let j = 0; j < cnt; j++)
        xyzi.push([buf[body + 4 + j * 4], buf[body + 5 + j * 4], buf[body + 6 + j * 4], buf[body + 7 + j * 4]]);
    } else if (tag === 'RGBA') {
      pal = [];
      for (let j = 0; j < 256; j++) pal.push([buf[body + j * 4], buf[body + j * 4 + 1], buf[body + j * 4 + 2]]);
    }
    i = body + n;
  }
  if (!xyzi) return toast('No voxels found in that file.', 'err');
  if (!pal) {
    pal = [];
    for (let j = 0; j < 256; j++) pal.push([200, 200, 200]);
  }
  const cx = Math.round((size ? size[0] : 0) / 2),
    cy = Math.round((size ? size[1] : 0) / 2);
  let s = '';
  for (const [x, y, z, c] of xyzi) {
    const col = pal[c - 1] || [200, 200, 200];
    s += String.fromCharCode(x, y, z, col[0], col[1], col[2]);
  }
  const rec = M.vox && typeof M.vox === 'object' ? M.vox : vxeOwn(M) || (M.vox = { vpm: 32, layers: [] });
  rec.layers.push({
    k: 'raw',
    name: f.name.replace(/\.vox$/i, ''),
    src: f.name,
    n: xyzi.length,
    vpm: 32,
    x: 0,
    y: 0,
    z: 0,
    ox: -cx,
    oy: -cy,
    oz: 0,
    data: btoa(s),
  });
  VXE.sel = rec.layers.length - 1;
  vxeBump(M);
  render();
  toast(`${xyzi.length} voxels imported (${size ? size.join('×') : '?'}).`);
};
/* any slider or field of the model: rebuild the mesh so the turntable follows */
document.addEventListener('input', ev => {
  const t = ev.target;
  if (!t || !t.dataset || !t.dataset.p || !SCN.ped) return;
  if (!t.dataset.p.startsWith(`scenery.props.${SCN.ped}.vox`)) return;
  const M = pedM();
  if (!M) return;
  clearTimeout(VXE.t);
  VXE.t = setTimeout(() => {
    M.voxV = (M.voxV || 0) + 1;
    if (typeof voxInvalidate === 'function') voxInvalidate('inline:' + SCN.ped + '#' + (M.voxV - 1));
  }, 60);
});

/* alpha 0.4: a layer that turns, or stops turning */
ACTS.vxeSpin = d => {
  const M = scD().props[SCN.ped],
    rec = M && vxeOwn(M);
  if (!rec) return;
  const l = rec.layers[+d.i];
  if (!l) return;
  if (l.spin) delete l.spin;
  else
    l.spin = {
      x: +(l.x || 0),
      y: +(l.y || 0),
      z: +((l.z || 0) + (l.h || 2 * (l.r || 0.3)) / 2).toFixed(2),
      axis: 'x',
      rps: 1.5,
    };
  vxeBump(M);
  render();
};
