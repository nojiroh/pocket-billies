// Studio track ST-5: loads game/js/robot-art.js in plain Node with the few browser names it touches, pictures that are
// only their sizes (no pixels), and a stand-in canvas whose drawing does nothing. Used by the robot and rig tests to
// build and compare robots' rigs.
import { createHash } from 'node:crypto';

globalThis.window ??= globalThis;
globalThis.PB_TEST_GLOBALS = true;
const noop = () => {};
const ctx = new Proxy({}, { get: () => noop, set: () => true });
globalThis.document ??= {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
  addEventListener: noop,
  getElementById: () => null,
  querySelector: () => null,
};
globalThis.Image ??= class {
  set src(v) {
    this._src = v;
  }
};

const art = await import('../../game/js/art.js');
export const robotArt = await import('../../game/js/robot-art.js');

/** pictures by path: [w, h]; each becomes a loaded picture of that size (any other path is missing) */
export function setPictures(sizes) {
  for (const k of Object.keys(art.ART_CACHE.img)) delete art.ART_CACHE.img[k];
  for (const [path, [w, h]] of Object.entries(sizes))
    art.ART_CACHE.img[path] = { __path: path, complete: true, naturalWidth: w, width: w, height: h };
}

/** every build's sp: gem.torso.armL.armR.legs */
export function robotBuilds(D) {
  const P = Object.entries(D.parts),
    of = slot => P.filter(([, p]) => p.slot === slot).map(([id]) => id),
    out = [];
  for (const g of Object.keys(D.gems))
    for (const t of of('torso'))
      for (const a of of('arm'))
        for (const b of of('arm')) for (const l of of('legs')) out.push(`bot:${g}.${t}.${a}.${b}.${l}`);
  return out;
}

/* a picture or stand-in canvas as plain numbers: the bone's offset and the picture's size and path */
const pic = p => p && { ox: p.ox, oy: p.oy, w: p.c.width, h: p.c.height, path: p.c.__path || 'drawn' };
/** a rig as plain data (pictures by size and path, so it can be compared and hashed) */
export function rigPlain(R) {
  if (!R) return null;
  const { bones, ...rest } = R;
  return {
    ...rest,
    bones: bones.map(({ img, imgB, ...b }) => ({
      ...b,
      img: pic(img),
      imgB: imgB === undefined ? undefined : pic(imgB),
    })),
  };
}
export const rigHash = R =>
  createHash('sha256')
    .update(JSON.stringify(rigPlain(R)))
    .digest('hex')
    .slice(0, 16);
