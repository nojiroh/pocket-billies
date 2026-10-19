// Layered pixel portrait renderer (prototype for phase 07).
// Everything is drawn at the native art size (T x T) and only moves in whole pixels.
/* global PORTRAIT_DATA */
const Portrait = (() => {
  const imgs = {};          // `${T}:${id}` -> HTMLImageElement
  const tintCache = new Map();

  function loadSize(T) {
    const d = PORTRAIT_DATA[T];
    return Promise.all(Object.entries(d.images).map(([id, src]) => new Promise((res) => {
      const im = new Image(); im.onload = () => { imgs[`${T}:${id}`] = im; res(); }; im.src = src;
    })));
  }

  // ---------- colour helpers ----------
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function makeRamp(color) {
    const c = hex(color);
    const shadow = mix(c, [24, 12, 40], 0.5);
    const deep = mix(c, [12, 6, 18], 0.8);
    const light = mix(c, [255, 250, 235], 0.45);
    return { deep, at: (t) => (t < 0.5 ? mix(shadow, c, t * 2) : mix(c, light, (t - 0.5) * 2)) };
  }

  // modes: 'map' (gradient map whole part), 'iris' (only grey mid-tones), 'skin' (map but keep outline dark)
  function tinted(T, id, color, mode = 'map') {
    const im = imgs[`${T}:${id}`];
    if (!im || !color) return im;
    const key = `${T}:${id}:${color}:${mode}`;
    if (tintCache.has(key)) return tintCache.get(key);
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height); const p = d.data;
    const R = makeRamp(color);
    let lo = 255, hi = 0;
    const L = (i) => 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    const sat = (i) => Math.max(p[i], p[i + 1], p[i + 2]) - Math.min(p[i], p[i + 1], p[i + 2]);
    for (let i = 0; i < p.length; i += 4) if (p[i + 3]) { const l = L(i); if (l > 60) { lo = Math.min(lo, l); hi = Math.max(hi, l); } }
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const l = L(i);
      let out;
      if (mode === 'iris') {
        if (sat(i) > 40 || l < 40 || l > 215) continue;
        out = R.at(Math.min(1, Math.max(0, (l - 40) / 175)));
      } else if (l <= 60) {
        out = mix(R.deep, [p[i], p[i + 1], p[i + 2]], 0.25);
      } else {
        out = R.at(hi > lo ? (l - lo) / (hi - lo) : 0.5);
      }
      p[i] = out[0]; p[i + 1] = out[1]; p[i + 2] = out[2];
    }
    cx.putImageData(d, 0, 0);
    tintCache.set(key, cv);
    return cv;
  }

  // ---------- layout ----------
  const HAIR_PAD = { hairS10: 4, hairS11: 6, hairS12: 8, hairS01: 2, hairS03: 3, hairS13: 1, hairLB02: 1, hairLB06: 4, hairLB07: 4, hairLB03: 0 };
  const HAT_BRIM = { hat00: 0.36, hat01: 0.33, hat02: 0.36, hat03: 0.30, hat10: -1, hat11: 0.42, hat12: 0.26, hat13: 0.34, hat20: 0.40, hat21: 0.28, hat22: 0.30, hat23: 0.30 };

  function layout(T, ch) {
    const M = PORTRAIT_DATA[T].manifest;
    const b = M.bases[ch.base];
    const HW = M.hw; const cx = T / 2;
    const eyeOx = Math.round(HW * 0.25);
    return { M, b, HW, cx, eyeOx };
  }

  // Draw one frame. state: {expr, eyes (frame name), mouth (key in mouth set), headDy, headDx, browShift}
  function draw(ctx, T, ch, st) {
    const { M, b, HW, cx, eyeOx } = layout(T, ch);
    const P = M.parts;
    ctx.clearRect(0, 0, T, T);
    const hx = st.headDx | 0, hy = st.headDy | 0;
    // layers: 'back' (long hair behind the body), 'body' (never moves), 'front' (head and everything on it).
    // st.only draws one layer, so the caller can move the head layers as a rig; without it everything is drawn.
    let layer = 'back';
    const on = () => !st.only || st.only === layer;
    const put = (id, x, y, color, mode) => {
      if (!on()) return;
      const im = tinted(T, id, color, mode); if (im) ctx.drawImage(im, x, y);
    };
    const hairColor = ch.hairColor;
    const skin = ch.skin === 'natural' ? null : ch.skin;

    // hair back (moves with the head)
    let longPair = null, shortHair = null;
    if (ch.hair.startsWith('L')) longPair = M.hairLong[+ch.hair.slice(1)];
    else if (ch.hair.startsWith('S')) shortHair = M.hairShort[+ch.hair.slice(1)];
    const hairTop = (id) => b.skullTop - Math.round(HW * (id.startsWith('hairL') ? 0.26 : 0.09)) - (HAIR_PAD[id] || 0);
    if (longPair) {
      const bk = P[longPair.back];
      put(longPair.back, Math.round(cx + bk.ox) + hx, hairTop(longPair.back) + hy, hairColor);
    }
    // body + clothes (do not move)
    layer = 'body';
    put(ch.base + '_body', b.x, b.y + P[ch.base + '_body'].y0, skin, 'skin');
    if (ch.top !== 'none') {
      const id = `${ch.top}@${ch.base}`; const p = P[id];
      put(id, Math.round(cx - p.w / 2), b.bottom - p.h, ch.topColor);
    }
    if (ch.acc.includes('2_3')) { const id = M.acc['2_3']; put(id, Math.round(cx - P[id].w / 2), b.neck + 1, ch.accColor); }
    // head
    layer = 'front';
    put(ch.base + '_head', b.x + hx, b.y + hy, skin, 'skin');
    const X = (x) => x + hx, Y = (y) => y + hy;
    // nose
    const nose = M.noses[ch.nose]; const np = P[nose];
    put(nose, X(Math.round(cx - np.w / 2)), Y(b.noseY - Math.round(np.h / 2)), skin, 'skin');
    // cheeks / skin marks
    const pair = (ids, ox, y, color, mode) => {
      const L = P[ids.L], R = P[ids.R];
      put(ids.L, X(cx - ox - Math.ceil(L.w / 2)), Y(y - Math.round(L.h / 2)), color, mode);
      put(ids.R, X(cx + ox - Math.floor(R.w / 2)), Y(y - Math.round(R.h / 2)), color, mode);
    };
    if (ch.extras.includes('0_0')) pair(M.extras['0_0'], eyeOx, b.noseY);
    if (ch.extras.includes('0_1') || st.blush) pair(M.extras['0_1'], eyeOx + 1, b.noseY + 1);
    if (ch.extras.includes('0_2')) { const id = M.extras['0_2']; put(id, X(cx + eyeOx - 2), Y(b.noseY - 2)); }
    if (ch.extras.includes('1_0')) pair(M.extras['1_0'], Math.round(HW * 0.24), b.mouthY);
    if (ch.extras.includes('1_1')) { const id = M.extras['1_1']; put(id, X(Math.round(cx - P[id].w / 2)), Y(b.mouthY - 1), hairColor); }

    // eyes
    const es = M.eyeStyles[ch.eyes];
    let fr = st.eyes in es.frames ? st.eyes : ({ angry: 'open', wide: 'open', narrow: 'half', bored: 'half', lookL: 'open', lookR: 'open', up: 'open', down: 'open' }[st.eyes] || 'open');
    const eyeTop = b.eyeY - Math.round(es.openH / 2);
    for (const side of ['L', 'R']) {
      const id = es.frames[fr][side]; const p = P[id];
      let y;
      if (es.kind === 'synth') y = eyeTop;
      else if (fr === 'closed' || fr === 'happy') y = eyeTop + Math.round(es.openH * 0.55) - Math.round(p.h / 2);
      else y = eyeTop + es.openH - p.h;
      const x = side === 'L' ? cx - eyeOx - Math.ceil(p.w / 2) : cx + eyeOx - Math.floor(p.w / 2);
      put(id, X(x), Y(y), ch.iris, 'iris');
    }
    // brows: pixel shear for angry / sad, lift for surprised
    const br = M.brows[ch.brow];
    for (const side of ['L', 'R']) {
      const id = br[side]; const p = P[id];
      if (!on()) break;
      const im = tinted(T, id, ch.browColor || hairColor);
      const x0 = side === 'L' ? cx - eyeOx - Math.ceil(p.w / 2) : cx + eyeOx - Math.floor(p.w / 2);
      const y0 = eyeTop - p.h - 1 + (st.browLift | 0);
      for (let x = 0; x < p.w; x++) {
        const tIn = side === 'L' ? x / Math.max(1, p.w - 1) : 1 - x / Math.max(1, p.w - 1); // 1 at the inner end
        const dy = Math.round((st.browTilt || 0) * tIn);
        ctx.drawImage(im, x, 0, 1, p.h, X(x0 + x), Y(y0 + dy), 1, p.h);
      }
    }
    // mouth
    const ms = M.mouthSets[ch.mouth];
    const mid = ms[st.mouth] || ms.closed; const mp = P[mid];
    if (!ch.acc.includes('2_0')) put(mid, X(Math.round(cx - mp.w / 2)), Y(b.mouthY - Math.round(mp.h / 2)));
    // facial hair
    const fh = { beard: '1_3', chin: '1_2', mustache: '2_0', goatee: '2_1' };
    if (ch.beard !== 'none') {
      const id = M.extras[fh[ch.beard]]; const p = P[id];
      const y = { beard: b.mouthY - Math.round(p.h * 0.45), chin: b.mouthY - Math.round(p.h * 0.25), mustache: b.mouthY - Math.round(mp.h / 2) - p.h + 2, goatee: b.mouthY + Math.round(mp.h / 2) }[ch.beard];
      put(id, X(Math.round(cx - p.w / 2)), Y(y), hairColor);
    }
    if (ch.acc.includes('1_3')) { const id = M.acc['1_3']; put(id, X(cx + eyeOx - 2), Y(b.noseY - 2)); }
    if (ch.acc.includes('2_0')) { const id = M.acc['2_0']; const p = P[id]; put(id, X(Math.round(cx - p.w / 2)), Y(b.mouthY - Math.round(p.h * 0.55)), ch.accColor); }
    // hair front
    if (longPair) {
      const f = P[longPair.front];
      put(longPair.front, X(Math.round(cx + f.ox)), Y(hairTop(longPair.back) + f.dy), hairColor);
    }
    if (shortHair) { const p = P[shortHair]; put(shortHair, X(Math.round(cx + p.ox)), Y(hairTop(shortHair)), hairColor); }
    // ear things
    const earMid = Math.round((b.earY0 + b.earY1) / 2);
    if (ch.acc.includes('1_2')) {
      const ids = M.acc['1_2'];
      put(ids.L, X(b.earL + 1 - Math.ceil(P[ids.L].w / 2)), Y(b.earY1 - 1), ch.accColor);
      put(ids.R, X(b.earR - 1 - Math.floor(P[ids.R].w / 2)), Y(b.earY1 - 1), ch.accColor);
    }
    if (ch.acc.includes('2_1')) { const id = M.acc['2_1']; put(id, X(b.earR - 4), Y(earMid - Math.round(P[id].h / 2)), ch.accColor); }
    // hat
    if (ch.hat !== 'none') {
      const id = M.hats[ch.hat]; const p = P[id];
      const brim = HAT_BRIM[id] ?? 0.3;
      const y = brim < 0 ? b.skullTop - Math.round(HW * 0.18) : b.skullTop + Math.round(b.faceH * brim) - p.h;
      put(id, X(Math.round(cx + p.ox)), Y(y), ch.hatColor);
    }
    if (ch.acc.includes('1_1')) { const id = M.acc['1_1']; const p = P[id]; put(id, X(Math.round(cx - p.w / 2)), Y(b.skullTop + Math.round(b.faceH * 0.2)), ch.accColor); }
    if (ch.acc.includes('2_2')) {
      const ids = M.acc['2_2'];
      put(ids.L, X(b.earL + 1 - Math.ceil(P[ids.L].w / 2)), Y(earMid - Math.round(P[ids.L].h / 2)), ch.accColor);
      put(ids.R, X(b.earR - 1 - Math.floor(P[ids.R].w / 2)), Y(earMid - Math.round(P[ids.R].h / 2)), ch.accColor);
    }
    // eyewear on top
    for (const k of ['0_0', '0_1', '0_2', '0_3']) if (ch.acc.includes(k)) {
      const id = M.acc[k]; const p = P[id];
      put(id, X(Math.round(cx - p.w / 2)), Y(b.eyeY - Math.round(p.h / 2)), k === '0_2' ? null : ch.accColor);
    }
    if (ch.acc.includes('1_0')) { const id = M.acc['1_0']; const p = P[id]; put(id, X(cx - eyeOx - Math.round(p.w * 0.3)), Y(b.eyeY - Math.round(p.h * 0.55))); }
    if (st.fx === 'shock') { const id = M.extras['0_3']; const p = P[id]; put(id, X(Math.round(cx - p.w / 2)), Y(b.skullTop - 2)); }
  }

  // ---------- expressions ----------
  const EXPR = {
    // pose: where the head settles (x, y in art px, a in degrees); sway: idle motion amount; hit: one-shot motion
    idle: { eyes: 'open', mouth: 'closed', browTilt: 0, browLift: 0, pose: [0, 0, 0], sway: 1 },
    happy: { eyes: 'happy', mouth: 'smile', browTilt: 0, browLift: -1, blush: true, talk: ['smile', 'talkB', 'talkC'], pose: [0, -0.8, 5], sway: 1.4, hit: 'bounce' },
    sad: { eyes: 'bored', mouth: 'frown', browTilt: -2, browLift: 0, pose: [0, 1.8, -3], sway: 0.5 },
    angry: { eyes: 'angry', mouth: 'angry', browTilt: 2, browLift: 1, pose: [0, 0.9, 0], sway: 0.6, hit: 'shake' },
    surprised: { eyes: 'wide', mouth: 'o', browTilt: 0, browLift: -2, pose: [0, -1.2, 0], sway: 0.4, hit: 'jolt' },
    hurt: { eyes: 'narrow', mouth: 'wince', browTilt: -2, browLift: 1, pose: [-1, 0.6, -6], sway: 0.5, hit: 'recoil' },
    smug: { eyes: 'half', mouth: 'smirk', browTilt: 1, browLift: 0, pose: [0.6, -0.4, -6], sway: 0.8 },
  };

  // rig points in art px: the neck pivot the head turns around, and the crown long hair hangs from
  function rig(T, ch) {
    const { b, cx } = layout(T, ch);
    return { cx, neckY: b.neck - 1, crownY: b.skullTop + 2, faceH: b.faceH };
  }

  return { loadSize, draw, EXPR, tinted, rig };
})();
