// @ts-check
'use strict';
/* ================= GRAFT ART (splicing track SP-1) =================
   A grafted Billie's recipe: its species' kit recipe (game/data/kitBuilds.json) with one or more slots' parts taken
   from another species' recipe, ready for kitBakeWhole (logic/kit-assemble.js) to bake at runtime. A graft is
   { slot: Gene id }, a Gene id "part@donor": a kit part and the donor rig whose colour and size it keeps (SP-2). The donor's part
   keeps its colour and its size on the donor (the fit scales the whole Billie down if it no longer fits the stage
   box). A slot is swapped only bone kind for bone kind (an arm for an arm or a wing, a leg for a leg or a foot, a tail
   for a tail): the baker places each kind its own way, so a tail can't stand in for legs. Extras and the head are
   not grafted yet. SP-2: the splice is saved on the Billie (graftOf, graftSet); its rules are logic/genes.js. Logic only: no DOM (tools/test/graft-art.test.mjs).
   RO-3c: placeholder Billies (logic/placeholder-art.js, any of the 14 body plans) are grafted by slot across plans,
   on their baked sheets and rigs (graftPlaceholder, below; tools/test/graft-placeholder.test.mjs). */
/** @import { PartKits } from '../../types/game-data' */
/** @typedef {import('./kit-assemble.js').KitForm} KitForm */
/** @typedef {Record<string, string>} Graft slot (rules.json parts.slots) -> Gene id, "part@donor" (SP-2) */
/** @typedef {import('./kit-pixels.js').Pixels} Pixels */
/** @typedef {import('./placeholder-art.js').BodyPlans} BodyPlans */
/** @typedef {import('./placeholder-art.js').PlaceholderForm} PlaceholderForm */
/** @typedef {import('./placeholder-art.js').PlaceholderBone} PlaceholderBone */
/**
 * @typedef {{ form: PlaceholderForm, rig: Record<string, any>, sheet: Pixels }} PlaceholderBaked a placeholder Billie
 *   as baked (placeholderBake): its form, its sheet and both views' rigs
 * @typedef {{ pic: Pixels, pv: [number, number] }} GraftPic a picture and its pivot inside it
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  PLACEHOLDER_BOX,
  PLACEHOLDER_VIEWS,
  kitBlank,
  kitBounds,
  kitDrawRest,
  kitFlipX,
  kitNearest,
  kitPack,
  kitPaste,
  kitTurnRight,
  placeholderBones,
  roundHalfEven,
} from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  BONE_OF_SLOT: [() => BONE_OF_SLOT],
  GRAFT_SHRINK: [() => GRAFT_SHRINK],
  GRAFT_SLOTS: [() => GRAFT_SLOTS],
  // @ts-expect-error -- replaced on purpose
  geneSplit: [() => geneSplit, v => (geneSplit = v)],
  // @ts-expect-error -- replaced on purpose
  graftAim: [() => graftAim, v => (graftAim = v)],
  // @ts-expect-error -- replaced on purpose
  graftCut: [() => graftCut, v => (graftCut = v)],
  // @ts-expect-error -- replaced on purpose
  graftDonors: [() => graftDonors, v => (graftDonors = v)],
  // @ts-expect-error -- replaced on purpose
  graftFit: [() => graftFit, v => (graftFit = v)],
  // @ts-expect-error -- replaced on purpose
  graftForm: [() => graftForm, v => (graftForm = v)],
  // @ts-expect-error -- replaced on purpose
  graftGroupPic: [() => graftGroupPic, v => (graftGroupPic = v)],
  // @ts-expect-error -- replaced on purpose
  graftGroups: [() => graftGroups, v => (graftGroups = v)],
  graftKey: [() => graftKey],
  // @ts-expect-error -- replaced on purpose
  graftKind: [() => graftKind, v => (graftKind = v)],
  // @ts-expect-error -- replaced on purpose
  graftLook: [() => graftLook, v => (graftLook = v)],
  // @ts-expect-error -- replaced on purpose
  graftLookSplit: [() => graftLookSplit, v => (graftLookSplit = v)],
  graftOf: [() => graftOf],
  // @ts-expect-error -- replaced on purpose
  graftParse: [() => graftParse, v => (graftParse = v)],
  // @ts-expect-error -- replaced on purpose
  graftPic: [() => graftPic, v => (graftPic = v)],
  // @ts-expect-error -- replaced on purpose
  graftPlaceholder: [() => graftPlaceholder, v => (graftPlaceholder = v)],
  // @ts-expect-error -- replaced on purpose
  graftPlaceholderAt: [() => graftPlaceholderAt, v => (graftPlaceholderAt = v)],
  // @ts-expect-error -- replaced on purpose
  graftPlaceholderDonors: [() => graftPlaceholderDonors, v => (graftPlaceholderDonors = v)],
  graftRecipe: [() => graftRecipe],
  // @ts-expect-error -- replaced on purpose
  graftSet: [() => graftSet, v => (graftSet = v)],
  graftTurn: [() => graftTurn],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the slots SP-1 grafts */
export const GRAFT_SLOTS = ['front', 'back', 'sig'];

/** a species' own recipe (its form's rig is the species id; a regional form has its own) @param {{ forms: KitForm[] }} B
 * @param {string} sp @returns {KitForm | null} */
export const graftRecipe = (B, sp) => B.forms.find(f => f.rig === sp) || null;

/** the bone kind of a recipe that fills a slot (the form's "slots" first, then partKits.json "slots"), or null
 * @param {PartKits} K @param {KitForm} form @param {string} slot */
export function graftKind(K, form, slot) {
  for (const kind of Object.keys(form.parts)) if ((form.slots?.[kind] ?? K.slots?.[kind]) === slot) return kind;
  return null;
}

/** a graft as a short, stable code for caches ("front=swift1,sig=zuck2"); '' for none @param {Graft | null | undefined} g */
export const graftKey = g =>
  g
    ? Object.keys(g)
        .sort()
        .map(s => `${s}=${g[s]}`)
        .join(',')
    : '';

/** a graft code (graftKey) back as a graft; null for '' or a code with no slot=donor pair @param {string | null | undefined} key
 * @returns {Graft | null} */
export function graftParse(key) {
  if (!key) return null;
  /** @type {Graft} */
  const g = {};
  for (const pair of key.split(',')) {
    const [slot, sp] = pair.split('=');
    if (slot && sp) g[slot] = sp;
  }
  return Object.keys(g).length ? g : null;
}

/* SP-2: a Billie's (or wild encounter's) splice is its `graft` field (Billy.graft, kept by the save's validators) */
/** a Billie's graft code, '' for none @param {{ graft?: Graft } | null | undefined} m */
export const graftOf = m => (m && typeof m === 'object' ? graftKey(m.graft) : '');
/** SP-5: how a Billie (or an encounter, a snapshot) looks: its graft code and, after it, each Augment as "+slot=part"
 * ("sig=shark_tailfin@zuck2,+front=hydrant"); its graft code alone when it has none, so nothing else changes. Only the
 * drawing reads it (skeleton-rig.js rigParts); the splice's own code stays graftOf @param {any} m */
export function graftLook(m) {
  const g = graftOf(m),
    a = m && typeof m === 'object' && m.aug && typeof m.aug === 'object' ? m.aug : null,
    more = a
      ? Object.keys(a)
          .sort()
          .filter(s => a[s] && typeof a[s].id === 'string')
          .map(s => `+${s}=${a[s].id}`)
      : [];
  return more.length ? [g, ...more].filter(Boolean).join(',') : g;
}
/** a look code (graftLook) as its graft code and its Augments ({ slot: robots.json part id }, null for none)
 * @param {string | null | undefined} code @returns {{ graft: string, aug: Record<string, string> | null }} */
export function graftLookSplit(code) {
  if (!code || !code.includes('+')) return { graft: code || '', aug: null };
  /** @type {Record<string, string>} */
  const aug = {};
  const own = [];
  for (const pair of code.split(',')) {
    if (pair[0] !== '+') own.push(pair);
    else {
      const [slot, id] = pair.slice(1).split('=');
      if (slot && id) aug[slot] = id;
    }
  }
  return { graft: own.join(','), aug: Object.keys(aug).length ? aug : null };
}
/** give a Billie (or an encounter) a graft code; '' takes it off @param {object} m @param {string} key */
export function graftSet(m, key) {
  const g = graftParse(key),
    o = /** @type {{ graft?: Graft }} */ (m);
  if (g) o.graft = g;
  else delete o.graft;
}

/** SP-2: a Gene id, "part@donor" (a kit part id and the donor rig it came from), as its two halves; null for
 * anything else @param {unknown} id @returns {{ part: string, donor: string } | null} */
export function geneSplit(id) {
  if (typeof id !== 'string') return null;
  const at = id.indexOf('@');
  return at > 0 && at < id.length - 1 && id.indexOf('@', at + 1) < 0
    ? { part: id.slice(0, at), donor: id.slice(at + 1) }
    : null;
}
/** the bone a part goes on, from its kind's usual slot (partKits.json slots): front an arm, back a leg, sig a tail */
export const BONE_OF_SLOT = /** @type {Record<string, string>} */ ({ front: 'arm', back: 'leg', sig: 'tail' });

/** the recipe of a species with its grafted slots' parts (a Gene's part, at its donor's colour and size), or null
 * when a Gene or a slot doesn't fit: no recipe, no such donor or part, a donor without that bone, a part that goes
 * on another bone @param {{ forms: KitForm[] }} B @param {PartKits} K @param {string} sp @param {Graft} graft
 * @returns {KitForm | null} */
export function graftForm(B, K, sp, graft) {
  const base = graftRecipe(B, sp);
  if (!base) return null;
  const out = { ...base, parts: { ...base.parts }, name: `${base.name}~${graftKey(graft)}` };
  for (const [slot, id] of Object.entries(graft)) {
    const gene = geneSplit(id),
      donor = gene && graftRecipe(B, gene.donor),
      P = gene && K.parts[gene.part],
      kind = graftKind(K, base, slot);
    if (!donor || !P || !kind || graftKind(K, donor, slot) !== kind) return null;
    if (BONE_OF_SLOT[/** @type {Record<string, string>} */ (K.slots || {})[P.kind]] !== kind) return null;
    const [, size, col] = donor.parts[kind];
    out.parts[kind] = [gene.part, Math.round(((size * donor.scale) / base.scale) * 1e4) / 1e4, col];
  }
  return out;
}

/** the Genes a species can take for a slot, one per donor ("part@donor"): another line, the same bone kind, a
 * different part @param {{ forms: KitForm[] }} B @param {PartKits} K @param {string} sp @param {string} slot
 * @returns {string[]} */
export function graftDonors(B, K, sp, slot) {
  const base = graftRecipe(B, sp),
    kind = base && graftKind(K, base, slot);
  if (!base || !kind) return [];
  return B.forms
    .filter(f => f.line !== base.line && graftKind(K, f, slot) === kind && f.parts[kind][0] !== base.parts[kind][0])
    .map(f => `${f.parts[kind][0]}@${f.rig}`);
}

/* ---------- RO-3c: placeholder Billies, grafted by slot across body plans ----------
   Splicing maps parts by slot (the owner, RO-3a): an octopus's tentacle can become a biped's arm. A graft works on the
   two Billies as baked (the sheet and rig the game already has, drawings included), so nothing else is loaded:
   - a slot's groups: a plan's own bones in it (mirrors follow their twin), a bone hanging on another bone of the
     slot carrying on that one's chain (an octopus's tentacle is one group of 3, a quad's front legs two of 1);
   - the receiver's group i takes the donor's group i mod n (a biped's arm fills both of a quad's front legs);
   - a single bone takes the donor's whole group, put together at rest (a tentacle for an arm); a chain takes the
     donor's bones spread along it, bone for bone when as long, so every bone still draws (a neck holding a head
     never breaks: an arm on each of an octopus's tentacle segments);
   - a slot the receiver or the donor has no bone in is refused (the octopus and the blob share one bone between
     body and head, bodyPlans.json `also`, and the body is never grafted);
   - each picture is fitted to the bone it lands on: turned in quarter turns (exact) to point the way that bone
     points and as long as it, its pivot on the joint; when either is held at its middle (a pot, a round foot) it
     lies along the bone inside its box, held where the bone holds its own; never past 1.5 times the bone's longest
     side; a mirrored twin
     takes the same picture flipped, as the baker does;
   - the rest pose must stay inside the stage box: else the grafted pictures shrink a step at a time, and a graft
     that still spills is refused (the plain Billie draws). */
export const GRAFT_SHRINK = [1, 0.9, 0.8, 0.7, 0.6, 0.5];

/** a slot's groups in a plan's bones: chains of bone names @param {PlaceholderBone[]} bones @param {string} slot
 * @returns {string[][]} */
export function graftGroups(bones, slot) {
  /** @type {string[][]} */
  const groups = [];
  for (const b of bones) {
    if (b.flip || b.slot !== slot || !b.size) continue;
    const chain = groups.find(g => g[g.length - 1] === b.par);
    if (chain) chain.push(b.n);
    else groups.push([b.n]);
  }
  return groups;
}

/** a picture cut out of a sheet @param {Pixels} sheet @param {number} x @param {number} y @param {number} w
 * @param {number} h @returns {Pixels} */
export function graftCut(sheet, x, y, w, h) {
  const o = kitBlank(w, h);
  for (let v = 0; v < h; v++)
    o.data.set(sheet.data.subarray(((y + v) * sheet.width + x) * 4, ((y + v) * sheet.width + x + w) * 4), v * w * 4);
  return o;
}
/** a bone's picture in one view of a baked Billie (its first frame) and its pivot; null when it draws nothing
 * @param {PlaceholderBaked} B @param {string} view @param {string} n @returns {GraftPic | null} */
export function graftPic(B, view, n) {
  const R = B.rig[view],
    b = R.bones.find((/** @type {any} */ x) => x.n === n);
  if (!b || b.i < 0) return null;
  const im = R.imgs[b.i],
    [x, y, w, h] = im.f.main || im.f.idle || Object.values(im.f)[0];
  return { pic: graftCut(B.sheet, x, y, w, h), pv: [-im.ox, -im.oy] };
}
/** a group of a baked Billie's bones put together at rest in one view, as one picture whose pivot is the first bone's
 * joint (each bone's own turn at rest left out: the group takes the turn of the bone it lands on)
 * @param {PlaceholderBaked} B @param {string} view @param {string[]} group @returns {GraftPic | null} */
export function graftGroupPic(B, view, group) {
  if (group.length === 1) return graftPic(B, view, group[0]);
  const R = B.rig[view],
    /** @type {Record<string, [number, number]>} */ J = {},
    parts = [];
  for (const n of group) {
    const b = R.bones.find((/** @type {any} */ x) => x.n === n),
      at = /** @type {[number, number]} */ (n === group[0] ? [0, 0] : [J[b.par][0] + b.at[0], J[b.par][1] + b.at[1]]);
    J[n] = at;
    const p = graftPic(B, view, n);
    if (p) parts.push({ z: view === 'back' ? b.zb : b.z, x: at[0] - p.pv[0], y: at[1] - p.pv[1], pic: p.pic });
  }
  if (!parts.length) return null;
  const x0 = Math.min(...parts.map(p => p.x)),
    y0 = Math.min(...parts.map(p => p.y)),
    x1 = Math.max(...parts.map(p => p.x + p.pic.width)),
    y1 = Math.max(...parts.map(p => p.y + p.pic.height)),
    pic = kitBlank(Math.ceil(x1 - x0), Math.ceil(y1 - y0));
  for (const p of parts.sort((a, b) => a.z - b.z)) kitPaste(pic, p.pic, Math.round(p.x - x0), Math.round(p.y - y0));
  return { pic, pv: [-x0, -y0] };
}
/** which way a picture points from its pivot (to its middle); [0, 0] for one held near its middle @param {GraftPic} g */
export function graftAim(g) {
  const dx = g.pic.width / 2 - g.pv[0],
    dy = g.pic.height / 2 - g.pv[1];
  return Math.hypot(dx, dy) < 0.2 * Math.max(g.pic.width, g.pic.height) ? [0, 0] : [dx, dy];
}
/** a quarter turn clockwise of a picture and its pivot @param {GraftPic} g @returns {GraftPic} */
export const graftTurn = g => ({ pic: kitTurnRight(g.pic), pv: [g.pic.height - g.pv[1], g.pv[0]] });
/** a donor's picture fitted to the receiver's bone it lands on: turned to point its way and as long as it, the
 * pivot on the bone's joint; when either is held at its middle, turned to lie along it, inside its box and held where
 * it holds its own; at most 1.5 times its longest side, then scaled by `k`
 * @param {GraftPic} d @param {GraftPic} r @param {number} k @returns {GraftPic} */
export function graftFit(d, r, k = 1) {
  const [ax, ay] = graftAim(r),
    [bx, by] = graftAim(d),
    aimed = (ax || ay) && (bx || by);
  let g = d;
  if (aimed) {
    /* the quarter turn whose pointing best matches: (x, y) turns to (-y, x) */
    const dots = [ax * bx + ay * by, -ax * by + ay * bx, -ax * bx - ay * by, ax * by - ay * bx];
    for (let t = dots.indexOf(Math.max(...dots)); t > 0; t--) g = graftTurn(g);
  } else if ((d.pic.width - d.pic.height) * (r.pic.width - r.pic.height) < 0) g = graftTurn(g); /* long side along */
  const { width: dw, height: dh } = g.pic,
    { width: rw, height: rh } = r.pic,
    fit = aimed ? (Math.abs(ax) >= Math.abs(ay) ? rw / dw : rh / dh) : Math.min(rw / dw, rh / dh),
    s = k * Math.min(fit, (1.5 * Math.max(rw, rh)) / Math.max(dw, dh)),
    w = Math.max(1, Math.round(dw * s)),
    h = Math.max(1, Math.round(dh * s)),
    /** @type {[number, number]} */
    pv = aimed ? [(g.pv[0] * w) / dw, (g.pv[1] * h) / dh] : [(r.pv[0] * w) / rw, (r.pv[1] * h) / rh];
  return { pic: kitNearest(g.pic, w, h), pv };
}
/** a placeholder Billie grafted: each slot of the graft from its donor (both baked), its sheet and both views' rigs
 * as placeholderBake gives them (marked with the graft); throws, saying why, when a slot is missing on either side
 * or the result doesn't fit the stage box
 * @param {BodyPlans} P @param {{ sheetW: number, margin: number }} D the baker's settings (kitBuilds.json bake)
 * @param {PlaceholderBaked} recv @param {Record<string, PlaceholderBaked>} donors slot -> donor
 * @returns {{ sheet: Pixels, rig: Record<string, any> }} */
export function graftPlaceholder(P, D, recv, donors) {
  const bones = placeholderBones(P, recv.form),
    /** @type {Record<string, string[][]>} */ mine = {},
    /** @type {Record<string, string[][]>} */ theirs = {};
  for (const [slot, donor] of Object.entries(donors)) {
    mine[slot] = graftGroups(bones, slot);
    theirs[slot] = graftGroups(placeholderBones(P, donor.form), slot);
    if (!mine[slot].length) throw new Error(`${recv.form.name} (${recv.form.plan}) has no ${slot} to graft`);
    if (!theirs[slot].length) throw new Error(`${donor.form.name} (${donor.form.plan}) has no ${slot} to give`);
  }
  for (const k of GRAFT_SHRINK) {
    const made = graftPlaceholderAt(bones, D, recv, donors, mine, theirs, k);
    if (made) return made;
  }
  throw new Error(`${recv.form.name} ~ ${Object.keys(donors).join(',')}: doesn't fit the stage box`);
}
/** graftPlaceholder with the grafted pictures scaled by k; null when it doesn't fit the stage box
 * @param {PlaceholderBone[]} bones @param {{ sheetW: number, margin: number }} D @param {PlaceholderBaked} recv
 * @param {Record<string, PlaceholderBaked>} donors @param {Record<string, string[][]>} mine
 * @param {Record<string, string[][]>} theirs @param {number} k */
export function graftPlaceholderAt(bones, D, recv, donors, mine, theirs, k) {
  const box = PLACEHOLDER_BOX,
    /** @type {Record<string, Record<string, GraftPic | null>>} */ put = {};
  for (const view of PLACEHOLDER_VIEWS) {
    /** @type {Record<string, GraftPic | null>} */
    const v = (put[view] = {});
    for (const [slot, donor] of Object.entries(donors))
      mine[slot].forEach((g, i) => {
        const d = theirs[slot][i % theirs[slot].length],
          fit = (/** @type {GraftPic | null} */ dp, /** @type {string} */ n) => {
            const rp = graftPic(recv, view, n);
            return dp && rp ? graftFit(dp, rp, k) : null;
          };
        if (g.length === 1) v[g[0]] = fit(graftGroupPic(donor, view, d), g[0]);
        else g.forEach((n, j) => (v[n] = fit(graftPic(donor, view, d[Math.floor((j * d.length) / g.length)]), n)));
      });
    /* a mirrored twin draws its bone's new picture flipped */
    for (const b of bones)
      if (b.flip && b.src in v) {
        const g = v[b.src];
        v[b.n] = g && { pic: kitFlipX(g.pic), pv: [g.pic.width - g.pv[0], g.pv[1]] };
      }
  }
  /* the pictures, packed as the baker packs them: every frame of an untouched bone, one of a grafted one */
  /** @type {Pixels[]} */
  const pics = [],
    /** @type {any[]} */ where = [];
  for (const view of PLACEHOLDER_VIEWS) {
    const R = recv.rig[view];
    for (const b of R.bones) {
      if (b.n in put[view]) {
        const g = put[view][b.n];
        if (g) where.push({ view, n: b.n, fn: 'main', pv: g.pv, i: pics.push(g.pic) - 1 });
      } else if (b.i >= 0) {
        const im = R.imgs[b.i];
        for (const [fn, [x, y, w, h]] of Object.entries(im.f))
          where.push({ view, n: b.n, fn, pv: [-im.ox, -im.oy], i: pics.push(graftCut(recv.sheet, x, y, w, h)) - 1 });
      }
    }
  }
  const { sheet, spots } = kitPack(pics, D.sheetW),
    /** @type {Record<string, any>} */ rig = {};
  for (const view of PLACEHOLDER_VIEWS) {
    const R = recv.rig[view],
      imgs = [],
      out = [],
      rest = [];
    for (const b of R.bones) {
      const mine = where.filter(w => w.view === view && w.n === b.n),
        nb = { ...b, i: -1 };
      if (mine.length) {
        nb.i = imgs.length;
        imgs.push({
          ox: -roundHalfEven(mine[0].pv[0]),
          oy: -roundHalfEven(mine[0].pv[1]),
          f: Object.fromEntries(mine.map(w => [w.fn, [...spots[w.i], pics[w.i].width, pics[w.i].height]])),
        });
      }
      out.push(nb);
      const first = mine[0];
      rest.push({
        ...b,
        frames: { main: first ? pics[first.i] : kitBlank(1, 1) },
        pivot: first ? first.pv : [0, 0],
      });
    }
    const [x0, y0, x1, y1] = kitBounds(kitDrawRest(rest, view === 'back', /** @type {any} */ ({ ...D, box })));
    if (x0 < D.margin || y0 < D.margin || x1 > box.w - D.margin || y1 > box.base + 2) return null;
    rig[view] = {
      ...R,
      geo: { ...R.geo, top: y0, mid: (y0 + box.base) / 2, hw: (x1 - x0) / 2, cy: (y0 + box.base) / 2 },
      size: [sheet.width, sheet.height],
      imgs,
      bones: out,
      graft: Object.entries(donors)
        .map(([slot, d]) => `${slot}=${d.form.rig}`)
        .sort()
        .join(','),
    };
  }
  return { sheet, rig };
}

/** the placeholder Billies that can give one a part for a slot: another line (another Billie when neither has a
 * line), and both have bones in the slot @param {BodyPlans} P @param {PlaceholderForm[]} forms @param {string} sp
 * @param {string} slot @returns {string[]} */
export function graftPlaceholderDonors(P, forms, sp, slot) {
  const base = forms.find(f => f.rig === sp);
  if (!base || !graftGroups(placeholderBones(P, base), slot).length) return [];
  return forms
    .filter(f => (base.line ? f.line !== base.line : f.rig !== sp))
    .filter(f => graftGroups(placeholderBones(P, f), slot).length)
    .map(f => f.rig);
}
