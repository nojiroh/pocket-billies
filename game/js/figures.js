'use strict';
/* ================= THE FIGURE BAKER (characters track CH-2, the spike; Engine > People > Figures, off) =================
   People as small 3D figures of jointed rigid parts, drawn into pixel pictures that go down today's sprite path. A
   figure is built in code (logic/figure-pose.js: the mannequin, its poses) or made from a rigged model by
   tools/gltf-figure.mjs (CH-3: game/art/figures/*.json and their palette-snapped textures; each vertex on its
   strongest joint, the model's clips sampled on the 12 fps clock). A baked picture is a plain canvas tagged as a person's
   (`ax`, `ay` the ground point, `ppm` its pixels a metre, `noNormal` the flat light people have), so the sprites,
   their shadows, AO, fog, the reflection, the outline round you and the person counters take it as they take a
   person-art.js frame, and nothing else in the renderer changes.
   - The baker draws in its own small WebGL2 context (the owner's pick: kept apart from the game's renderer state).
     Pass 1 draws the figure with its depth into a texture: each face in one of three toon bands from a top-left light,
     the scene props' ramps (a code figure's from its palette, a model's from its texture); the depth goes in alpha.
     Pass 2, at the same pixels: the dark plum outline round it (each outside pixel next to the figure takes the
     outline of its colour, as tools/build-scene-props.py olc) and inside it where a part stands well in front of
     another. Then the pixels go to a 2D canvas, and a code figure's face is painted on it in whole pixels (eyes,
     mouth, blush: logic/figure-pose.js figureFaceMarks).
   - Two styles (Engine > People > Style): 'pixel', the pixel puppet (C) described here, and 'smooth', the plain 3D
     figure (B): a soft light and no outline, baked at FIGURE_SMOOTH_PPM and left to the GPU's mipmaps.
   - Pictures are kept by figure, clip, frame, the view's steps, the density, the outline and the style (figureKey):
     at most FIGURE_CACHE_MAX of them and FIGURE_CACHE_BYTES. One is baked a frame, up to FIGURE_BAKES_A_FRAME while
     the frame's work budget lasts; until then a person keeps their last picture (or today's, or none on a test map).
   - A lost baker context bakes nothing until it is back, then rebuilds; the game's own lost context only drops the
     textures, and the canvases are uploaded again. figureBakerLose forces a loss for the checks.
   - Close-ups (dialogue track DL-6): a talking person's head and shoulders (figureBustPicture), seen level, the head
     turned by the talk's director in stepped angles (logic/figure-pose.js headStep: at most 45 pictures a figure),
     kept apart from the world's pictures; the face painted on a copy each tick (figureBustFace) with the director's
     eyes and mouth, so a blink or a word costs no bake. The rest pose first, at most one bake every FIGURE_BUST_GAP
     ms, the nearest kept angle shown meanwhile.
   The renderer never calls this with the switch off, and a model's file is only fetched when one is first wanted. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  PEOPLE,
  figureAtlasOn,
  figureAtlasPicture,
  figureAtlasReport,
  provide,
  reducedMotion,
  talkBox,
} from './hooks.js';
import {
  FIGURE_BANDS,
  FIGURE_LIGHT,
  FIGURE_PAL_MAX,
  OUTLINE_RGB,
  WALK_CYCLE_M,
  bustSize,
  cardSize,
  clipFrameAt,
  codeExtent,
  figureBlinkAt,
  figureClipMatrix,
  figureDark,
  figureDensityStep,
  figureFaceMarks,
  figureFaceState,
  figureKey,
  figureMarkHidden,
  figureMix,
  figureMotion,
  figureMotionClip,
  figurePose,
  figureRamp,
  figureSceneLight,
  figureStride,
  figureTalkFace,
  figureTick,
  figureView,
  headKey,
  headStep,
  jointMatrices,
  mannequinFigure,
  meshClipFrame,
  meshClipMatrices,
  meshHeadPivot,
  nearestHead,
  turnHeadPose,
  turnJointAbout,
} from './logic/figure-pose.js';
import { figureKitData, figureSeed, kappiFigure, kitBuild, lookFigure } from './logic/figure-kit.js';
import { artImg, artURL, makeCanvas } from './art.js';
import { lookOf, wardrobeData } from './person-art.js';
import { RUN_FACTOR, WALK_SPEED, seenYaw, walkView } from './walk-view.js';
import { engineContext, engineSetting } from './engine/settings.js';
import { gpuState } from './engine/webgl.js';
import { environment } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { frameBudgetLeft } from './walk/quality-cull.js';
import { figureMeshGet, figureMeshKeep, figureMeshReport } from './figure-meshes.js';
/* eslint-disable no-func-assign */
expose({
  FIGURE_BAKES_A_FRAME: [() => FIGURE_BAKES_A_FRAME],
  FIGURE_BATTLE_PPM: [() => FIGURE_BATTLE_PPM],
  FIGURE_BUSTS: [() => FIGURE_BUSTS],
  FIGURE_BUST_GAP: [() => FIGURE_BUST_GAP],
  FIGURE_BUST_MAX: [() => FIGURE_BUST_MAX],
  FIGURE_BUST_TURN: [() => FIGURE_BUST_TURN],
  FIGURE_CACHE: [() => FIGURE_CACHE],
  FIGURE_CACHE_BYTES: [() => FIGURE_CACHE_BYTES],
  FIGURE_CACHE_MAX: [() => FIGURE_CACHE_MAX],
  FIGURE_DEFS: [() => FIGURE_DEFS],
  FIGURE_FILES: [() => FIGURE_FILES],
  FIGURE_FS: [() => FIGURE_FS],
  FIGURE_LOOKS: [() => FIGURE_LOOKS],
  FIGURE_LOOK_NAMES: [() => FIGURE_LOOK_NAMES],
  FIGURE_OUT_FS: [() => FIGURE_OUT_FS],
  FIGURE_OUT_VS: [() => FIGURE_OUT_VS],
  FIGURE_PALETTES: [() => FIGURE_PALETTES],
  FIGURE_PENDING: [() => FIGURE_PENDING],
  FIGURE_PORTRAIT_PPM: [() => FIGURE_PORTRAIT_PPM],
  FIGURE_SHADOW_FS: [() => FIGURE_SHADOW_FS],
  FIGURE_SHADOW_SIZE: [() => FIGURE_SHADOW_SIZE],
  FIGURE_SHADOW_VS: [() => FIGURE_SHADOW_VS],
  FIGURE_SMOOTH_PPM: [() => FIGURE_SMOOTH_PPM],
  FIGURE_SNAPS: [() => FIGURE_SNAPS],
  FIGURE_SNAP_MAX: [() => FIGURE_SNAP_MAX],
  FIGURE_STUDIO_LIGHT: [() => FIGURE_STUDIO_LIGHT],
  FIGURE_TALK_NEAR: [() => FIGURE_TALK_NEAR],
  FIGURE_TEXTURES: [() => FIGURE_TEXTURES],
  FIGURE_VS: [() => FIGURE_VS],
  HD2D_BODY: [() => HD2D_BODY],
  bakeFigure: [() => bakeFigure, v => (bakeFigure = v)],
  figureBaker: [() => figureBaker],
  figureBakerLose: [() => figureBakerLose, v => (figureBakerLose = v)],
  figureBattlePicture: [() => figureBattlePicture, v => ((figureBattlePicture = v), provide({ figureBattlePicture }))],
  figureBuild: [() => figureBuild, v => (figureBuild = v)],
  figureBust: [() => figureBust, v => (figureBust = v)],
  figureBustFace: [() => figureBustFace, v => (figureBustFace = v)],
  figureBustPicture: [() => figureBustPicture, v => (figureBustPicture = v)],
  figureBytes: [() => figureBytes, v => (figureBytes = v)],
  figureCacheClear: [() => figureCacheClear, v => (figureCacheClear = v)],
  figureChoice: [() => figureChoice, v => (figureChoice = v)],
  figureCompile: [() => figureCompile, v => (figureCompile = v)],
  figureCycle: [() => figureCycle, v => (figureCycle = v)],
  figureDef: [() => figureDef, v => (figureDef = v)],
  figureDensity: [() => figureDensity],
  figureDesign: [() => figureDesign, v => (figureDesign = v)],
  figureFaceFor: [() => figureFaceFor, v => (figureFaceFor = v)],
  figureFarPpm: [() => figureFarPpm, v => (figureFarPpm = v)],
  figureFolk: [() => figureFolk, v => ((figureFolk = v), provide({ figureFolk }))],
  figureFor: [() => figureFor, v => (figureFor = v)],
  figureFromFile: [() => figureFromFile, v => (figureFromFile = v)],
  figureFromLook: [() => figureFromLook, v => (figureFromLook = v)],
  figureGait: [() => figureGait],
  figureGl: [() => figureGl, v => (figureGl = v)],
  figureItems: [() => figureItems, v => (figureItems = v)],
  figureKitNow: [() => figureKitNow, v => (figureKitNow = v)],
  figureKitRevision: [() => figureKitRevision, v => (figureKitRevision = v)],
  figureKitState: [() => figureKitState],
  figureKitUse: [() => figureKitUse, v => (figureKitUse = v)],
  figureLast: [() => figureLast],
  figureLightNow: [() => figureLightNow, v => (figureLightNow = v)],
  figureLightSpace: [() => figureLightSpace, v => (figureLightSpace = v)],
  figureLoad: [() => figureLoad, v => (figureLoad = v)],
  figureLookColour: [() => figureLookColour, v => (figureLookColour = v)],
  figureLookHash: [() => figureLookHash, v => (figureLookHash = v)],
  figureLookRamp: [() => figureLookRamp, v => (figureLookRamp = v)],
  figureMarkClip: [() => figureMarkClip, v => (figureMarkClip = v)],
  figureMeshHead: [() => figureMeshHead, v => (figureMeshHead = v)],
  figureMoves: [() => figureMoves],
  figurePaintFace: [() => figurePaintFace, v => (figurePaintFace = v)],
  figurePaintMark: [() => figurePaintMark, v => (figurePaintMark = v)],
  figurePalette: [() => figurePalette, v => (figurePalette = v)],
  figurePersonPicture: [() => figurePersonPicture, v => (figurePersonPicture = v)],
  figurePicture: [() => figurePicture, v => (figurePicture = v)],
  figurePortrait: [() => figurePortrait, v => (figurePortrait = v)],
  figurePreview: [() => figurePreview, v => (figurePreview = v)],
  figurePreviewForget: [() => figurePreviewForget, v => (figurePreviewForget = v)],
  figurePreviewLook: [() => figurePreviewLook, v => (figurePreviewLook = v)],
  figurePreviewState: [() => figurePreviewState],
  figureReport: [() => figureReport, v => (figureReport = v)],
  figureRes: [() => figureRes, v => (figureRes = v)],
  figureSlotMatrices: [() => figureSlotMatrices, v => (figureSlotMatrices = v)],
  figureSnapshot: [() => figureSnapshot, v => (figureSnapshot = v)],
  figureStrides: [() => figureStrides],
  figureStyle: [() => figureStyle, v => (figureStyle = v)],
  figureStyledName: [() => figureStyledName, v => (figureStyledName = v)],
  figureTarget: [() => figureTarget, v => (figureTarget = v)],
  figureTilt: [() => figureTilt, v => (figureTilt = v)],
  figuresOn: [() => figuresOn, v => ((figuresOn = v), provide({ figuresOn }))],
});
/* eslint-enable no-func-assign */
provide({ figureBattlePicture, figureFolk, figuresOn });
/* to-module: end */
const FIGURE_CACHE_MAX = 600,
  /** and at most this many bytes of them (a plain 3D picture at 128 px a metre is about 340 KB, a pixel one 23 KB) */
  FIGURE_CACHE_BYTES = 48 * 1048576,
  FIGURE_BAKES_A_FRAME = 4,
  /** the plain 3D figure (B, the style "smooth") is baked this fine and left to the GPU's mipmaps to smooth */
  FIGURE_SMOOTH_PPM = 128,
  /** figures in battle, where a trainer stands 150 CSS px tall: twice the world's 48 (CH-3b: the owner's "high
   * resolution"; CH-3 baked them at 64) */
  FIGURE_BATTLE_PPM = 96,
  /** DL-6: close-ups: at most this many kept (45 head angles of three figures), one baked every this many ms */
  FIGURE_BUST_MAX = 135,
  FIGURE_BUST_GAP = 50,
  /** and seen this far round from straight on (radians; a three-quarter look reads as 3D) */
  FIGURE_BUST_TURN = 0.3;
/** the figures made from models (tools/gltf-figure.mjs; their CC0 sources in validation/cc0-src/LICENSES.md), each
 * a JSON file and its texture */
const FIGURE_FILES = { rogue: 'figures/rogue.json' };
const FIGURE_TEXTURES = { rogue: 'figures/rogue.png' };
/** the baker: its canvas and context, programs, each figure's buffers and texture, and counts (debug log: people) */
const figureBaker = {
  cv: null,
  gl: null,
  ready: false,
  lost: 0,
  failed: '',
  P: null,
  O: null,
  Sh: null,
  smTex: null,
  smFb: null,
  oVao: null,
  fb: null,
  tex: null,
  depth: null,
  size: [0, 0],
  res: new Map(),
  bakes: 0,
  ms: 0,
  bytes: 0,
  losses: 0,
  frame: -1,
  frameBakes: 0,
  busts: 0,
  bustMs: 0,
  bustAt: -1e9,
};
const FIGURE_CACHE = new Map();
/** DL-6: the close-ups by figure, style, outline and head angle (figureBustPicture) */
const FIGURE_BUSTS = new Map();
/** each person's last picture (a runtime record or a test map's lineup entry; nothing is written on them) */
const figureLast = new WeakMap();
/** the figures by name: a code figure at once; a model's once its file is in (null while it loads, false if it can't) */
const FIGURE_DEFS = {};
/** CH-4: the kit figures whose mesh is being built (figure-meshes.js), by name */
const FIGURE_PENDING = new Map();

/** whether people are drawn as figures (Engine > People > Figures) */
export function figuresOn() {
  return typeof engineSetting === 'function' && !!engineSetting('people', 'figures');
}
/** the figure you are (Engine > People > Your figure): 'look', your own look through the figure kit (CH-3b), or
 * the spike's mannequin or stand-in */
export function figureChoice() {
  const v = typeof engineSetting === 'function' ? engineSetting('people', 'figure') : null;
  return v === 'mannequin' || v in FIGURE_FILES ? v : 'look';
}
/** the figures' names by who and style (an NPC's look never changes in the game; yours is keyed by the look itself
 * each time, so the dressing room's changes make a new figure) */
const FIGURE_LOOK_NAMES = new Map();
/** CH-5: the figure kit's data the figures are built with: the Studio's while it previews (figureKitUse), else the
 * game's (game/data/figureKit.json); and its revision, a hash of it, in every figure's name */
const figureKitState = { own: /** @type {any} */ (null), rev: '' };
function figureKitNow() {
  return figureKitState.own || figureKitData();
}
function figureKitRevision() {
  if (!figureKitState.rev) figureKitState.rev = figureSeed(JSON.stringify(figureKitNow())).toString(36);
  return figureKitState.rev;
}
/**
 * CH-5: build figures with this kit data from now on (the Studio's figure preview, as it is edited), or the game's
 * again (null): every figure's name changes with it, so each person is built again when next drawn
 * @param {any} kit
 */
function figureKitUse(kit) {
  figureKitState.own = kit || null;
  figureKitState.rev = '';
  FIGURE_LOOK_NAMES.clear();
  FIGURE_PENDING.clear();
  for (const k of Object.keys(FIGURE_DEFS)) if (k.startsWith('look:')) delete FIGURE_DEFS[k];
}
/** what a person's figure is built from, as a short hash: their look, their `figure` choice and the kit's revision
 * (CH-5: a figure is cached by what makes it, so an edit to any of them makes a new one) @param {any} look @param {string} who */
function figureLookHash(look, who) {
  const p = typeof PEOPLE !== 'undefined' && PEOPLE[who];
  return figureSeed(JSON.stringify([look || {}, (p && p.figure) || null, figureKitRevision()])).toString(36);
}
/**
 * the figure a person is drawn as (CH-3b): `look:<who>#<hash>` for anyone with a look (people/<id>.json, a
 * townsperson's 'folk:<seed>', a friend), `look:me#<hash>` for you ('boy', 'girl' or 'me'), or the spike's figure for
 * you when Engine > People > Your figure picks one. The hash is what the figure is built from (figureLookHash).
 */
export function figureFor(who) {
  if (who === 'boy' || who === 'girl' || who === 'me') {
    const c = figureChoice();
    if (c !== 'look') return c;
    const L = typeof lookOf === 'function' ? lookOf('me') : null;
    return 'look:me#' + figureLookHash(L, 'me') + figureDesign(figureStyle());
  }
  /* a direction with its own designs (its cast, flair or proportions: FIGURE_LOOKS) builds everyone its way */
  const st = figureStyle(),
    k = who + '@' + st;
  let n = FIGURE_LOOK_NAMES.get(k);
  if (!n) {
    const L = typeof lookOf === 'function' ? lookOf(who) : null;
    n = 'look:' + who + '#' + figureLookHash(L, who) + figureDesign(st);
    /* kept once the look is in (before the game data is, it is asked again) */
    if (L) FIGURE_LOOK_NAMES.set(k, n);
  }
  return n;
}
/** the '@direction' a figure's name carries when the style has designs of its own (figureDef reads it), else '' */
function figureDesign(style) {
  const LK = FIGURE_LOOKS[style];
  return LK && (LK.cast || LK.flair || LK.chibi) ? '@' + style : '';
}
/** how figures are drawn (Engine > People > Style): 'pixel' (the pixel puppet, C) or 'smooth' (the plain 3D figure, B) */
export function figureStyle() {
  const v = typeof engineSetting === 'function' ? engineSetting('people', 'style') : null;
  return v === 'smooth' || (typeof v === 'string' && v in FIGURE_LOOKS) ? v : 'pixel';
}
/** whether townsfolk are drawn as figures too (Engine > People > Townsfolk as figures) */
export function figureFolk() {
  return typeof engineSetting === 'function' && !!engineSetting('people', 'folk');
}
/** a figure by name: null while its file loads, false if there is none */
function figureDef(name) {
  if (name in FIGURE_DEFS) return FIGURE_DEFS[name];
  if (name === 'mannequin') {
    const F = mannequinFigure();
    return (FIGURE_DEFS[name] = { kind: 'code', name, F, height: F.height, ext: codeExtent(F.height) });
  }
  /* CH-3b: a person's figure from their look (logic/figure-kit.js); Kappi, a creature person, as a capybara */
  if (name.startsWith('look:')) {
    /* CH-4: a figure whose mesh is being built: made once, asked for again until it is in */
    const F0 = FIGURE_PENDING.get(name);
    if (F0) {
      const at0 = name.indexOf('@'),
        LK0 = (at0 > 0 && FIGURE_LOOKS[name.slice(at0 + 1)]) || FIGURE_LOOKS[figureStyle()] || FIGURE_LOOKS.pixel,
        d0 = LK0.detail || 1,
        G0 = figureMeshGet(name + '|' + d0, F0, d0, true);
      if (!G0) return null;
      FIGURE_PENDING.delete(name);
      return (FIGURE_DEFS[name] = { kind: 'code', name, F: F0, height: F0.height, ext: G0.ext });
    }
    const at = name.indexOf('@'),
      look0 = at > 0 ? FIGURE_LOOKS[name.slice(at + 1)] : null,
      who = (at > 0 ? name.slice(5, at) : name.slice(5)).split('#')[0],
      L = typeof lookOf === 'function' ? lookOf(who) : null,
      items = figureItems();
    if (!L || (!L.creature && !items)) return null;
    const F = figureFromLook(name, who, L, look0, items, figureKitNow());
    /* CH-4: one build of its mesh, at the detail its direction draws it, gives its extent and its first GPU mesh, on
       the helper thread (figure-meshes.js): until it is in, the person keeps today's picture */
    const detail = (look0 || FIGURE_LOOKS[figureStyle()] || FIGURE_LOOKS.pixel).detail || 1,
      G = figureMeshGet(name + '|' + detail, F, detail, true);
    if (!G) {
      FIGURE_PENDING.set(name, F);
      return null;
    }
    FIGURE_PENDING.delete(name);
    return (FIGURE_DEFS[name] = { kind: 'code', name, F, height: F.height, ext: G.ext });
  }
  if (!(name in FIGURE_FILES)) return (FIGURE_DEFS[name] = false);
  FIGURE_DEFS[name] = null;
  figureLoad(name);
  return null;
}
/**
 * a person's figure from their look (CH-3b; CH-5: with this kit data): their bag only if their own look has one, a
 * direction's redress and design for them (FIGURE_LOOKS: its flair, cast and proportions), their head and build
 * (people/<id>.json `figure`; you the hero's head; townsfolk any build), Kappi as a capybara
 * @param {string} name @param {string} who @param {any} L their look @param {any} look0 the direction (or null)
 * @param {any} items the wardrobe's items @param {any} kit the kit's data @param {any} [fig] their `figure` (the
 * Studio's draft), else the game data's
 */
function figureFromLook(name, who, L, look0, items, kit, fig) {
  const p = typeof PEOPLE !== 'undefined' && PEOPLE[who],
    /* the owner (2026-10-28): no backpack unless the person's own look has a bag (the wardrobe gives everyone one
       by default: person-art.js DEFAULT_WEAR); townsfolk and you keep the bag their look picked */
    own = p && p.look && p.look.wear,
    look1 = own && !own.bag && L.wear ? { ...L, wear: { ...L.wear, bag: null } } : L,
    /* a hybrid variant can redress everyone (its flair's wear) and each of its cast (its cast table's); CH-7 (the
       owner: your picks win): never you, who wear what the dressing room picked */
    wear0 =
      look0 && who !== 'me'
        ? {
            ...((look0.flair && look0.flair.wear) || {}),
            ...((look0.cast && look0.cast[who] && look0.cast[who].wear) || {}),
          }
        : null,
    look = wear0 && look1.wear && Object.keys(wear0).length ? { ...look1, wear: { ...look1.wear, ...wear0 } } : look1,
    F = L.creature
      ? kappiFigure({ name })
      : lookFigure(look, items, {
          kit,
          name,
          seed: figureSeed(who),
          /* you: the main character's own head (figureKit.json heads.hero) */
          figure: fig
            ? fig
            : p && p.figure
              ? p.figure
              : who === 'me'
                ? { head: 'hero' }
                : who.startsWith('folk:')
                  ? { variety: true }
                  : undefined,
          chibi: look0 && look0.chibi ? look0.chibi : undefined,
          /* a direction's flair, and its design for this person (its cast table) */
          flair: look0 && look0.flair ? { ...look0.flair, ...((look0.cast && look0.cast[who]) || {}) } : undefined,
        });
  /* CH-7: your colours as you picked them (a direction's palette and saturation leave them be) */
  if (who === 'me' && F) F.exact = true;
  return F;
}
/** the wardrobe's items (their default colours), for the figure kit; null before the game data is in */
function figureItems() {
  const W = typeof wardrobeData === 'function' ? wardrobeData() : null;
  return W ? W.items : null;
}
/** a figure's file, fetched once (inline in a single-file build: a data: link, decoded here) */
function figureLoad(name) {
  const path = FIGURE_FILES[name],
    url = typeof artURL === 'function' ? artURL(path) : 'art/' + path,
    done = j => {
      try {
        FIGURE_DEFS[name] = j ? figureFromFile(name, j) : false;
      } catch (e) {
        FIGURE_DEFS[name] = false;
        if (typeof debugLog !== 'undefined') debugLog.add('figures', name + ': ' + ((e && e.message) || e));
      }
      if (!FIGURE_DEFS[name] && typeof debugLog !== 'undefined') debugLog.add('figures', name + ': not loaded');
    };
  if (url.startsWith('data:')) {
    const c = url.indexOf(','),
      body = url.slice(c + 1);
    try {
      done(
        JSON.parse(
          /;base64/.test(url.slice(5, c)) ? new TextDecoder().decode(figureBytes(body)) : decodeURIComponent(body)
        )
      );
    } catch (e) {
      done(null);
    }
    return;
  }
  fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(done, () => done(null));
}
/** base64 to bytes */
function figureBytes(b64) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
/** a figure from its file (tools/gltf-figure.mjs, format 1): its mesh, joints, clips, extent and texture */
function figureFromFile(name, j) {
  if (j.format !== 1) throw new Error('figure format ' + j.format);
  const clips = {};
  for (const [k, c] of Object.entries(j.clips || {}))
    clips[k] = { ...c, mats: new Float32Array(figureBytes(c.matrices).buffer) };
  return {
    kind: 'mesh',
    name,
    height: j.height,
    joints: j.joints,
    ext: j.extent,
    data: new Float32Array(figureBytes(j.vertices).buffer),
    index: new Uint16Array(figureBytes(j.indices).buffer),
    clips,
    tex: typeof artImg === 'function' ? artImg(FIGURE_TEXTURES[name] || j.texture) : null,
  };
}

export const FIGURE_VS = `#version 300 es
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in float aJ;layout(location=3) in float aC;
layout(location=4) in vec2 aUV;uniform mat4 uJ[32];uniform mat4 uM;uniform mat3 uR;uniform mat4 uLS;
out vec3 vN;out vec2 vUV;out vec3 vLS;out vec3 vP;flat out int vC;
void main(){mat4 J=uJ[int(aJ)];vec4 w=J*vec4(aP,1.);vN=uR*(mat3(J)*aN);vC=int(aC);vUV=aUV;vP=uR*w.xyz;
 vLS=(uLS*vec4(vP+vN*.03,1.)).xyz;gl_Position=uM*w;}`;
/* CH-3b's fidelity pass: the figure's depth seen from the light, so parts shade each other (hair on the brow, the
   head on the neck, an arm on the body) */
const FIGURE_SHADOW_VS = `#version 300 es
layout(location=0) in vec3 aP;layout(location=2) in float aJ;uniform mat4 uJ[32];uniform mat3 uR;uniform mat4 uLS;
void main(){gl_Position=uLS*vec4(uR*(uJ[int(aJ)]*vec4(aP,1.)).xyz,1.);}`;
const FIGURE_SHADOW_FS = `#version 300 es
precision mediump float;out vec4 o;void main(){o=vec4(1.);}`;
/* a code figure's colours come from its palette (its ramps); a model's from its texture, ramped here as the props'
   ramp does it (logic/figure-pose.js figureRamp: the shadow darker and lavender, the light warmer). Smooth (the plain
   3D figure): a soft light, no bands. CH-3b's directions (FIGURE_LOOKS: uMode): 0 the pixel puppet's bands, 1 cel
   (two hard tones), 2 HD-2D (the bands on a hue-shifted ramp), 3 toy (a soft stepped gradient and a gloss dot),
   4 painterly (bands, a warm rim, each part's colour a touch off), 5 comic (flat colour, halftone dots in the shadow,
   a white rim), 6 faceted (each triangle flat) */
const FIGURE_FS = `#version 300 es
precision highp float;in vec3 vN;in vec2 vUV;in vec3 vLS;in vec3 vP;flat in int vC;uniform vec3 uPal[140];uniform vec3 uL;
uniform vec4 uB;uniform float uTexOn,uSmooth,uShadowOn,uH,uFlat;uniform int uMode,uSkinC;uniform vec4 uFx,uRim2;uniform vec3 uRimCol,uKeyT,uAmbT,uWarm;
uniform sampler2D uTx;uniform highp sampler2D uSM;
out vec4 o;
void main(){vec3 n=normalize(vN);
 if(uMode==6){n=normalize(cross(dFdx(vP),dFdy(vP)));if(n.z>0.)n=-n;}
 float d=mix(dot(n,uL),.3,uFlat*.45);int b=d>uB.z?3:(d>uB.x?2:(d>uB.y?1:(d>uB.w?0:-1)));
 /* a part in another's shadow (the light's depth map) drops to the shadow tone */
 bool shd=false;
 /* skin takes only shadows thrown from further off (a brim, an arm), not its own nose's or cheekbones' (smudges) */
 if(uShadowOn>.5&&d>uB.y){vec3 q=vLS*.5+.5;shd=q.x>0.&&q.y>0.&&q.x<1.&&q.y<1.&&q.z-(vC==uSkinC?.016:.006)>texture(uSM,q.xy).r;}
 bool rim=!shd&&n.z>-.25&&dot(normalize(n.xy+1e-4),normalize(uL.xy))>.55;
 if(shd)b=min(b,0);else if(rim&&b>=0&&uMode!=1&&uMode!=6)b=max(b,2);
 vec3 base,sh,li,sn,dp;
 if(uTexOn>.5){base=floor(texture(uTx,vUV).rgb*255.+.5);sh=mix(floor(base*.79),vec3(96.,74.,152.),.17);li=mix(base,vec3(255.,244.,196.),.3);sn=li;dp=mix(floor(base*.55),vec3(60.,42.,112.),.3);}
 else{dp=uPal[vC*5];sh=uPal[vC*5+1];base=uPal[vC*5+2];li=uPal[vC*5+3];sn=uPal[vC*5+4];}
 vec3 c=b==3?sn:(b==2?li:(b==1?base:(b==0?sh:dp)));
 if(uSmooth>.5)c=base*clamp(.62+.5*d,.35,1.12);
 else if(uMode==1){c=(d>-.05&&!shd)?((d>uB.z&&sn!=li)?sn:base):sh;}
 else if(uMode==3){float l=shd?min(d,-.15):d;float v=clamp(.6+.48*l,.32,1.08);v=floor(v*7.+.5)/7.;
  c=mix(sh,base,clamp(v*1.4-.4,0.,1.))*mix(1.,v+.2,.35);
  vec3 h=normalize(uL+vec3(0.,0.,-1.));float sp=pow(max(dot(n,h),0.),36.);if(!shd&&sp>.55)c=mix(c,vec3(255.,252.,240.),.75);}
 else if(uMode==4){c*=1.+.07*(fract(sin(float(vC)*12.9898)*43758.5)-.5);if(rim)c=mix(c,vec3(255.,214.,150.),.35);}
 else if(uMode==5){if(shd||d<=uB.y){vec2 g=fract(gl_FragCoord.xy/3.)-.5;float r=d<uB.w?.62:.38;c=length(g)<r?sh*.88:base;}
  else c=base;if(rim)c=mix(c,vec3(255.),.55);}
 /* 7: HD-2D painted (CH-3b's hybrid): the bands with their edges dithered (a 2 x 2 Bayer step on the light, uFx.x), a
    gradient from cool feet to a warm head (uFx.y), grain (uFx.z), the warm rim (uFx.w) and a second, cool rim from
    behind (uRim2: its way and strength, uRimCol) */
 else if(uMode==7){ivec2 fp=ivec2(gl_FragCoord.xy)&1;float bay=(fp.x==fp.y?(fp.x==0?0.:.5):(fp.x==0?.75:.25))-.375;
  float dd=d+bay*uFx.x;int bb=dd>uB.z?3:(dd>uB.x?2:(dd>uB.y?1:(dd>uB.w?0:-1)));
  int b0=bb;if(shd)bb=min(bb,0);else if(rim&&bb>=0)bb=max(bb,2);
  if(vC==uSkinC)bb=max(bb,0);
  c=bb==3?sn:(bb==2?li:(bb==1?base:(bb==0?sh:dp)));
  /* a cast shadow (a brim on a face) on a side that faces the light is lifted toward the base, so a face under a
     hat still reads */
  if(shd&&b0>=1)c=mix(sh,base,.4);
  float hy=clamp(vP.y/max(uH,.5),0.,1.);c*=mix(vec3(.9,.93,1.05),vec3(1.05,1.02,.95),mix(.5,hy,uFx.y));
  vec2 gp=floor(gl_FragCoord.xy*vec2(1.,.5));float g=fract(sin(dot(gp,vec2(12.9898,78.233)))*43758.5453)-.5;c*=1.+g*uFx.z;
  if(rim)c=mix(c,uWarm,.32*uFx.w);
  if(uRim2.w>0.&&dot(n,normalize(uRim2.xyz))>.5&&n.z>-.5)c=mix(c,uRimCol,uRim2.w);
  c=clamp(c,0.,255.);}
 /* CH-3b: the scene's light: the lit side takes the key's colour, the shade the sky's */
 if(uSmooth<.5){float t=shd?0.:smoothstep(uB.w,uB.x,d);c=clamp(c*mix(uAmbT,uKeyT,t),0.,255.);}
/* the depth, nearer larger, in alpha: 0 is no figure */
o=vec4(c/255.,mix(1.,.08,gl_FragCoord.z));}`;
const FIGURE_OUT_VS = `#version 300 es
in vec2 aQ;void main(){gl_Position=vec4(aQ*2.-1.,0.,1.);}`;
/* the outline: `uOutW` pixels thick (1 or 2), each pixel the outline of its nearest neighbour's colour (selective,
   the props' olc) or one ink (uInk); inside, where a part stands `uInner` (alpha's depth) in front of another, a line */
const FIGURE_OUT_FS = `#version 300 es
precision highp float;uniform sampler2D uT;uniform float uOut,uInk,uInner,uAO;uniform int uOutW;uniform vec3 uOL;uniform ivec2 uS;out vec4 o;
vec3 olc(vec3 c){return uInk>1.5?mix(c*.42,uOL,.35):uInk>.5?uOL*.55:mix(floor(c*255.*.45)/255.,uOL,.8);}
vec4 at(ivec2 p){return (p.x<0||p.y<0||p.x>=uS.x||p.y>=uS.y)?vec4(0.):texelFetch(uT,p,0);}
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=at(p);
 vec4 q[4]=vec4[4](at(p+ivec2(1,0)),at(p-ivec2(1,0)),at(p+ivec2(0,1)),at(p-ivec2(0,1)));
 if(c.a==0.){
  if(uOut<.5){o=vec4(0.);return;}
  /* beside the figure (within uOutW): the outline of the nearest neighbour's colour */
  vec4 best=vec4(0.);
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){if(abs(x)+abs(y)>uOutW||(x==0&&y==0))continue;vec4 v=at(p+ivec2(x,y));if(v.a>best.a)best=v;}
  o=best.a>0.?vec4(olc(best.rgb),1.):vec4(0.);return;}
 o=vec4(c.rgb,1.);
 /* a pixel of a part with a part well in front of it beside it: a line, half the outline's weight (ink: full) */
 if(uOut>.5&&uInner>0.){bool line=false;for(int i=0;i<4;i++)if(q[i].a>c.a+uInner)line=true;if(line)o.rgb=mix(c.rgb,olc(c.rgb),uInk>.5?.85:.6);}
 /* CH-3b: soft occlusion where a part tucks under a nearer one (a collar's shadow on the neck, an arm's on the
    side): the nearer neighbours within two pixels darken it toward violet */
 if(uAO>0.){float k=0.;for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){vec4 v=at(p+ivec2(x,y));if(v.a>c.a+.012)k+=1.;}
  o.rgb=mix(o.rgb,o.rgb*vec3(.62,.58,.82),uAO*min(1.,k/7.));}}`;

function figureCompile(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('figure shader: ' + gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('figure program: ' + gl.getProgramInfoLog(p));
  const U = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const u = gl.getActiveUniform(p, i),
      name = u.name.replace(/\[0\]$/, '');
    U[name] = gl.getUniformLocation(p, u.name);
  }
  return { p, U, a: k => gl.getAttribLocation(p, k) };
}
/** the baker's context, made the first time a figure is baked; null while lost or if WebGL2 refuses it */
function figureGl() {
  const B = figureBaker;
  if (B.failed) return null;
  if (!B.cv) {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 256;
    cv.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      B.lost = 1;
      B.ready = false;
      B.losses++;
      if (typeof debugLog !== 'undefined') debugLog.add('figures', 'baker context lost');
    });
    cv.addEventListener('webglcontextrestored', () => {
      B.lost = 0;
      if (typeof debugLog !== 'undefined') debugLog.add('figures', 'baker context restored');
    });
    B.cv = cv;
    B.gl = cv.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!B.gl) {
      B.failed = 'no WebGL2 context';
      if (typeof debugLog !== 'undefined') debugLog.add('figures', 'baker: ' + B.failed);
      return null;
    }
  }
  const gl = B.gl;
  if (B.lost || gl.isContextLost()) return null;
  if (!B.ready)
    try {
      figureBuild(gl);
      B.ready = true;
    } catch (e) {
      B.failed = String((e && e.message) || e);
      if (typeof debugLog !== 'undefined') debugLog.add('figures', 'baker: ' + B.failed);
      return null;
    }
  return gl;
}
/** the programs, the screen quad and the pass-1 target, on a new or restored context (each figure's own buffers and
 * texture are made again the next time it is baked) */
function figureBuild(gl) {
  const B = figureBaker;
  B.P = figureCompile(gl, FIGURE_VS, FIGURE_FS);
  B.Sh = figureCompile(gl, FIGURE_SHADOW_VS, FIGURE_SHADOW_FS);
  /* the light's depth map: FIGURE_SHADOW_SIZE square, depth only */
  B.smTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, B.smTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, FIGURE_SHADOW_SIZE, FIGURE_SHADOW_SIZE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  B.smFb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, B.smFb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, B.smTex, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  B.O = figureCompile(gl, FIGURE_OUT_VS, FIGURE_OUT_FS);
  B.res = new Map();
  B.oVao = gl.createVertexArray();
  gl.bindVertexArray(B.oVao);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const qa = B.O.a('aQ');
  gl.enableVertexAttribArray(qa);
  gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  B.fb = null;
  B.size = [0, 0];
  figureTarget(gl, B.cv.width, B.cv.height);
}
/** a figure's buffers (and a model's texture) in the baker's context; null while a model's texture loads */
function figureRes(gl, Fig, detail = 1) {
  const B = figureBaker,
    key = detail !== 1 ? Fig.name + '|' + Math.round(detail * 100) : Fig.name;
  let R = B.res.get(key);
  if (R) return R;
  if (Fig.kind === 'mesh' && !(Fig.tex && Fig.tex.complete && Fig.tex.naturalWidth > 0)) return null;
  const code = Fig.kind === 'code',
    /* CH-4: the figure's mesh at this detail, from the helper thread (figure-meshes.js); none yet: not drawn yet */
    M = code ? figureMeshGet(Fig.name + '|' + detail, Fig.F, detail) : null;
  if (code && !M) return null;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, code ? M.data : Fig.data, gl.STATIC_DRAW);
  /* a code figure: x y z, the normal, its joint, its colour (8 numbers); a model: x y z, the normal, its joint, u v (9) */
  const L = code
      ? [
          ['aP', 3, 0],
          ['aN', 3, 3],
          ['aJ', 1, 6],
          ['aC', 1, 7],
        ]
      : [
          ['aP', 3, 0],
          ['aN', 3, 3],
          ['aJ', 1, 6],
          ['aUV', 2, 7],
        ],
    stride = code ? 32 : 36;
  for (const k of ['aP', 'aN', 'aJ', 'aC', 'aUV']) {
    const a = B.P.a(k);
    if (a < 0) continue;
    const l = L.find(x => x[0] === k);
    if (l) {
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, l[1], gl.FLOAT, false, stride, l[2] * 4);
    } else gl.disableVertexAttribArray(a);
  }
  let count = code ? M.count : Fig.index.length,
    tex = null;
  if (!code) {
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Fig.index, gl.STATIC_DRAW);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, Fig.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  gl.bindVertexArray(null);
  R = { vao, vb, count, indexed: !code, tex, colours: code ? M.colours : null, slots: code ? M.slots : null };
  B.res.set(key, R);
  return R;
}
/** pass 1's colour (alpha the depth) and depth, as big as the baker's canvas */
function figureTarget(gl, w, h) {
  const B = figureBaker;
  if (B.size[0] === w && B.size[1] === h && B.fb) return;
  if (B.fb) {
    gl.deleteFramebuffer(B.fb);
    gl.deleteTexture(B.tex);
    gl.deleteRenderbuffer(B.depth);
  }
  B.tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, B.tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  B.depth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, B.depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  B.fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, B.tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, B.depth);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  B.size = [w, h];
}
/**
 * CH-3b's six directions, to sample and combine (the owner, 2026-10-28: "give me 6 samples of new directions that you
 * can later combine"): each a set of axes: the shader's mode (FIGURE_FS), the ramp its colours take (figurePalette),
 * the outline's width, ink and inner lines, the mesh's detail, the proportions (the kit's chibi) and the density.
 * 'pixel' is where CH-3b's fidelity pass stood.
 */
export const FIGURE_LOOKS = {
  pixel: { mode: 0, ramp: 'props', outline: 1, ink: 0, inner: 0.016, detail: 1, ppm: 48 },
  /* Link's Awakening (2019): a figurine in a diorama, chunky, glossy, no line */
  toy: {
    mode: 3,
    ramp: 'props',
    outline: 0,
    inner: 0,
    detail: 1.6,
    ppm: 48,
    chibi: { head: 1.3, legs: 0.74, torso: 0.86, arms: 0.84, neck: 0.4 },
  },
  /* Octopath Traveler: a sprite in a lit world: taller, coarser, hue-shifted ramps, a selective outline */
  hd2d: {
    mode: 2,
    ramp: 'hue',
    outline: 1,
    ink: 0,
    inner: 0.016,
    detail: 1,
    ppm: 30,
    chibi: { head: 0.92, legs: 1.04, torso: 1.0, arms: 1.0, neck: 1.0 },
  },
  /* Sugimori's Gen 5: two hard tones, a thick ink line, bright flat colour */
  cel: {
    mode: 1,
    ramp: 'cel',
    outline: 2,
    ink: 1,
    inner: 0.012,
    detail: 1.3,
    ppm: 48,
    chibi: { head: 1.2, legs: 0.82, torso: 0.9, arms: 0.88, neck: 0.7 },
  },
  /* Ghibli and Ni no Kuni: soft bands, warm light against cool shadow, no line, a warm rim */
  paint: { mode: 4, ramp: 'hue', outline: 0, inner: 0, detail: 1.3, ppm: 48 },
  /* Hi-Fi Rush and comics: flat colour, halftone dots in the shadow, thick ink, a white rim */
  comic: { mode: 5, ramp: 'cel', outline: 2, ink: 1, inner: 0.01, detail: 1.3, ppm: 48 },
  /* low-poly art: flat-shaded triangles, angular forms, no line */
  facet: {
    mode: 6,
    ramp: 'props',
    outline: 0,
    inner: 0,
    detail: 0.45,
    ppm: 48,
    chibi: { head: 1.05, legs: 0.92, torso: 0.95, arms: 0.95, neck: 0.9 },
  },
};
/* CH-3b: HD-2D crossed with the painterly direction (the owner: "Try hd 2d with painterly ... really go nuts. Give me
   5 variants"): FIGURE_FS mode 7, each pushing a different way */
const HD2D_BODY = { head: 0.94, legs: 1.04, torso: 1.0, arms: 1.0, neck: 1.0 };
Object.assign(FIGURE_LOOKS, {
  /* 1 dusk: warm light on violet shadow in big shapes, dithered edges, a soft coloured line; long coats all round */
  dusk: {
    mode: 7,
    ramp: 'hue',
    palette: 'dusk',
    fx: [0.22, 0.7, 0.05, 1],
    bands: { light: 0.42, base: 0.08, shine: 0.84, deep: -0.4 },
    outline: 1,
    ink: 2,
    inner: 0.016,
    detail: 1.2,
    ppm: 32,
    chibi: HD2D_BODY,
    flair: { hair: 1.15, wear: { outer: 'trench' } },
  },
  /* 2 storybook: a tall, slender illustration (four heads), paper grain, warm head to cool feet, pastel coats and
     scarves, no line */
  story: {
    mode: 7,
    ramp: 'hue',
    palette: 'story',
    fx: [0.08, 1, 0.12, 0.6],
    bands: { light: 0.38, base: -0.15, shine: 0.9, deep: -0.6 },
    outline: 0,
    inner: 0,
    detail: 1.3,
    ppm: 36,
    chibi: { head: 0.78, legs: 1.32, torso: 1.08, arms: 1.12, neck: 1.6 },
    flair: { hair: 1.12, scarf: true, wear: { outer: 'labcoat' }, col: [232, 165, 160] },
  },
  /* 3 lantern night: half the figure in deep violet shadow, a warm key, a hard cyan rim from behind, scarves */
  night: {
    mode: 7,
    ramp: 'hue',
    palette: 'night',
    fx: [0.14, 0.3, 0.03, 0.9],
    bands: { light: 0.55, base: 0.22, shine: 0.86, deep: -0.2 },
    rim2: [0.85, 0.25, 0.5, 0.85],
    rimCol: [110, 236, 246],
    outline: 1,
    ink: 0,
    inner: 0.016,
    detail: 1.2,
    ppm: 32,
    chibi: HD2D_BODY,
    flair: { hair: 1.15, scarf: true, col: [95, 183, 192] },
  },
  /* 4 Octopath travellers: chunky 24 px a metre, three and a half heads, five tones dithered hard, a thin dark
     line, everyone a traveller in a cape */
  octo: {
    mode: 7,
    ramp: 'hue',
    palette: 'octo',
    fx: [0.34, 0.45, 0, 0.8],
    outline: 1,
    ink: 0,
    inner: 0.016,
    detail: 1,
    ppm: 24,
    chibi: { head: 0.86, legs: 1.12, torso: 1.02, arms: 1.02, neck: 1.0 },
    flair: { cape: true, col: [177, 62, 83] },
  },
  /* 5 gouache bold: saturated, a big head and huge hair on a small body, a coloured line, a cape and a streaming
     scarf */
  gouache: {
    mode: 7,
    ramp: 'hue',
    palette: 'gouache',
    sat: 1.3,
    fx: [0, 0.5, 0.05, 1],
    bands: { light: 0.4, base: -0.05, shine: 0.8, deep: -0.45 },
    outline: 1,
    ink: 2,
    inner: 0.016,
    detail: 1.4,
    ppm: 40,
    chibi: { head: 1.18, legs: 0.86, torso: 0.92, arms: 0.92, neck: 0.8 },
    flair: { hair: 1.4, scarf: true, cape: true, col: [230, 57, 70] },
  },
});
/* CH-3b: gouache bold crossed with lantern night (the owner: "Do a mix of gauche bold and lantern night. Completely
   redesign their aesthetic. Make them way more detailed. Expressive detailed faces and shapes"): saturated gouache
   colour under a lantern's warm key, deep navy and violet shadow, a hard cyan rim from behind, soft occlusion where
   parts meet, brush grain, an anime ring of light on the hair, a coloured line; big hair, redesigned outfits */
FIGURE_LOOKS.gnight = {
  mode: 7,
  ramp: 'hue',
  palette: 'gnight',
  sat: 1.3,
  fx: [0.1, 0.4, 0.05, 1],
  bands: { light: 0.46, base: 0.1, shine: 0.8, deep: -0.32 },
  rim2: [0.85, 0.25, 0.5, 0.7],
  rimCol: [104, 232, 244],
  ring: 0.7,
  ao: 0.75,
  outline: 1,
  ink: 2,
  inner: 0.014,
  detail: 1.5,
  ppm: 48,
  /* the owner (2026-10-28): "the eyes look way too chibi and cute": about 3.2 heads, not 2.6 */
  chibi: { head: 0.9, legs: 1.06, torso: 1.03, arms: 1.03, neck: 1.0 },
  flair: { hair: 1.25, scarf: true, col: [230, 57, 70], detail: true },
  /* each of the cast redesigned for the look (the owner: "Completely redesign their aesthetic") */
  cast: {
    me: { goggles: true, gloves: true, ahoge: true, col: [95, 183, 192], wear: { outer: 'denim_jacket' } },
    chosen: { goggles: true, ahoge: true, col: [255, 209, 102], wear: { outer: 'labcoat' } },
    chad: { gloves: true, earrings: true, col: [244, 162, 97], wear: { outer: 'track_top' } },
    vault: { fur: true, gloves: true, gloveCol: [240, 236, 226], scarf: false, wear: { outer: 'trench' } },
    morel: { earrings: true, col: [167, 201, 87], wear: { outer: 'trench' } },
    poppy: { gloves: true, gloveCol: [106, 153, 78], col: [244, 162, 97] },
    marina: { earrings: true, col: [42, 157, 143], wear: { outer: 'denim_jacket' } },
    alta: { goggles: true, col: [168, 218, 220], wear: { outer: 'trench' } },
    carat: { goggles: true, gloves: true, col: [255, 209, 102] },
    crude: { gloves: true, gloveCol: [92, 58, 46], col: [231, 111, 81], wear: { outer: 'puffer' } },
    markdown: { earrings: true, col: [199, 125, 255] },
    clerk: { scarf: false, wear: { neck: 'tie' } },
  },
};
/** the matrices of a figure's moving parts, in its GPU mesh's slot order (logic/figure-pose.js figureGpuMesh) */
export function figureSlotMatrices(J, slots) {
  const out = new Float32Array(slots.length * 16);
  slots.forEach((i, k) => out.set(J.subarray(i * 16, i * 16 + 16), k * 16));
  return out;
}
/** the light a figure is baked in away from a scene (a portrait, the Studio's sheets): the fixed top-left light, no
 * tint */
const FIGURE_STUDIO_LIGHT = Object.freeze({
  L: FIGURE_LIGHT,
  flat: 0,
  keyT: [1, 1, 1],
  ambT: [1, 1, 1],
  rim: [0.85, 0.25, 0.5],
  rimCol: [104, 232, 244],
  rimK: 1,
  key: 's',
});
/**
 * the light of the scene a figure stands in this frame (logic/figure-pose.js figureSceneLight): the walk's sun (a
 * room's window light, the moon), its sky and the lamps near `at` (world x, z), seen from this frame's camera; null
 * with no scene drawing (a portrait, the Studio)
 */
function figureLightNow(at) {
  const R = typeof walkRenderer !== 'undefined' ? walkRenderer : null,
    C = typeof walkView !== 'undefined' ? walkView.C : null;
  if (!R || !R.sun || !C || !C.right || !C.fwd) return null;
  const X = R.X || null,
    y = at && typeof standingHeightAt === 'function' ? standingHeightAt(at[0], at[1]) : 0,
    E =
      typeof environment !== 'undefined' && typeof engineContext !== 'undefined' && engineContext.env
        ? environment
        : null;
  return figureSceneLight({
    sunDir: R.sun.dir,
    sunCol: R.sun.col,
    amb: X && X.ambTop ? X.ambTop : undefined,
    lamps: X && X.lights ? X.lights : undefined,
    at: at ? [at[0], y + 1, at[1]] : null,
    right: C.right,
    fwd: C.fwd,
    dark: R.sun.room ? 0.4 : E ? Math.max(E.lampK || 0, E.night || 0) : 0,
  });
}
/** the light's depth map's size (pixels square) */
const FIGURE_SHADOW_SIZE = 512;
/**
 * the matrix from a figure's turned frame (x to the camera's right, y up, z into the view) to the light's clip space:
 * an orthographic view along the light (FIGURE_LIGHT points to it) round the figure's middle, as big as its extent
 */
function figureLightSpace(ext, L = FIGURE_LIGHT) {
  const f = [-L[0], -L[1], -L[2]],
    rr = (() => {
      const x = [f[2], 0, -f[0]],
        l = Math.hypot(x[0], x[2]) || 1;
      return [x[0] / l, 0, x[2] / l];
    })(),
    up = [rr[1] * f[2] - rr[2] * f[1], rr[2] * f[0] - rr[0] * f[2], rr[0] * f[1] - rr[1] * f[0]],
    E = ext || { r: 0.7, top: 1.9, bottom: 0 },
    C = [0, ((E.top || 1.9) + (E.bottom || 0)) / 2, 0],
    H = (E.top || 1.9) * 0.62 + (E.r || 0.7),
    D = H * 1.2,
    row = (/** @type {number[]} */ a, /** @type {number} */ k) => [
      a[0] * k,
      a[1] * k,
      a[2] * k,
      -(a[0] * C[0] + a[1] * C[1] + a[2] * C[2]) * k,
    ],
    X = row(rr, 1 / H),
    Y = row(up, 1 / H),
    Z = row(f, 1 / D);
  return new Float32Array([X[0], Y[0], Z[0], 0, X[1], Y[1], Z[1], 0, X[2], Y[2], Z[2], 0, X[3], Y[3], Z[3], 1]);
}
/** CH-3b's hybrid variants: curated palettes a figure's colours are pulled to, so a whole cast sits in one painting */
const FIGURE_PALETTES = {
  dusk: '2b1d3a 45305e 6b4a8a 3c5b7a 4f8a8b 8fc1a9 f2e3c6 f6c38e e8955e c4573f 8c3b3b d9a441 f4d27a a3c46c 5f8f4e 7a5a3f b88b5a 1f2a44 e6e1d7',
  story:
    'f7efe2 e9d8c4 f2c7c2 e8a5a0 c98a9b a7b8d8 7f97c4 5d6f9e b9d6c3 88b49b 5f8c74 f2dfa0 e2b867 c68f5a 8e6a52 5a4a5e 3e3550 d8c1e0 a98cc4',
  night:
    '0f1226 1c2147 2e356b 47508f 6b78b8 9fb3e0 f2c46d e8954a c2603a 7a3a4a 4a2a4a 2c1f3a 3f7f8f 5fb7c0 b8e6e0 f2e6d0 a87a6a 6a4a5a',
  octo: '1a1c2c 5d275d b13e53 ef7d57 ffcd75 a7f070 38b764 257179 29366f 3b5dc9 41a6f6 73eff7 f4f4f4 94b0c2 566c86 333c57 8b5a3c 7a4841',
  gouache:
    '1d3557 457b9d a8dadc f1faee e63946 f4a261 e9c46a 2a9d8f 264653 6a994e a7c957 bc4749 f2e8cf 8d5a97 c08497 6d4c41 ffbe0b 3a0ca3',
};
FIGURE_PALETTES.gnight =
  '141833 1d2552 2e3a7a 4a5bb0 7d93d9 b8c9f0 2a9d8f 5fb7c0 a8e6e0 f1faee f2e8cf ffd166 f4a261 e76f51 e63946 9b2242 5c1a3a 3a0ca3 7b2cbf c77dff 6a994e a7c957 6d4c41 b07d62 e5b299';
/** a figure's colour as a direction takes it: its saturation pushed (LK.sat), then pulled toward the nearest colour of
 * the direction's palette (LK.palette; skin only a little, eyes and shines not at all) */
function figureLookColour(c, key, LK, exact = false) {
  if (!LK || exact || (!LK.palette && !LK.sat)) return c;
  let v = [c[0], c[1], c[2]];
  if (LK.sat) {
    const l = 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2];
    v = v.map(x => Math.max(0, Math.min(255, Math.round(l + (x - l) * LK.sat))));
  }
  const P = LK.palette && FIGURE_PALETTES[LK.palette];
  if (!P || key === 'eye' || key === 'glint' || key === 'iris') return v;
  let best = null,
    bd = Infinity;
  for (const h of P.split(' ')) {
    const q = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)],
      dr = q[0] - v[0],
      dg = q[1] - v[1],
      db = q[2] - v[2],
      dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (dist < bd) {
      bd = dist;
      best = q;
    }
  }
  const k = key === 'skin' || key === 'nose' || key === 'blush' ? 0.3 : 0.85;
  return v.map((x, i) => Math.round(x + (best[i] - x) * k));
}
/** a colour's five shades for a direction's ramp: the props' (figureRamp), a stronger hue shift (warm lights, cool
 * violet shadows: HD-2D, painterly), or cel's (one shadow, no light band) */
function figureLookRamp(b, ramp) {
  if (ramp === 'hue')
    return [
      figureMix(figureDark(b, 0.42), [38, 28, 104], 0.45),
      figureMix(figureDark(b, 0.7), [78, 58, 168], 0.34),
      [b[0], b[1], b[2]],
      figureMix(b, [255, 224, 150], 0.36),
      figureMix(b, [255, 246, 214], 0.62),
    ];
  if (ramp === 'cel') {
    const sh = figureMix(figureDark(b, 0.74), [90, 70, 160], 0.22);
    return [sh, sh, [b[0], b[1], b[2]], [b[0], b[1], b[2]], figureMix(b, [255, 255, 255], 0.5)];
  }
  return figureRamp(b);
}
/** a code figure's palette for the shader: for each colour, its shadow, base and light (the props' ramp) */
export function figurePalette(F, colours, ramp = 'props', LK = null) {
  /* FIGURE_PAL_MAX colours, five shades each (the shader's uPal[140]): the deep shadow, the shadow, the base, the
     light and the shine, which only a glossy colour (F.gloss: hair, shoes, lenses) has; the rest keep their light */
  const out = new Float32Array(FIGURE_PAL_MAX * 5 * 3),
    gloss = new Set(F.gloss || []);
  colours.forEach((k, i) => {
    /* CH-6: skin in its hand-picked shades (figureKit.json faces.skin), but in cel's two */
    const R =
        k === 'skin' && F.skinRamp && ramp !== 'cel'
          ? F.skinRamp
          : figureLookRamp(figureLookColour(F.colours[k], k, LK, !!F.exact), ramp),
      flat = k === 'eye' || k === 'glint';
    [
      flat ? R[2] : R[0],
      flat ? R[2] : R[1],
      R[2],
      flat ? R[2] : R[3],
      flat ? R[2] : gloss.has(k) ? (LK && LK.ring ? figureMix(R[4], [255, 252, 240], LK.ring) : R[4]) : R[3],
    ].forEach((c, b) => out.set(c, (i * 5 + b) * 3));
  });
  return out;
}
/**
 * one picture of a figure: its pose at a clip's frame, seen in view V at `ppm` pixels a metre, in a style ('pixel':
 * toon bands and the outline as `outline` says; 'smooth': the plain 3D figure, a soft light and no outline). A canvas
 * tagged as a person's picture, or null if the baker can't draw it now. DL-6, `o`: `bust`, a window (logic/figure-pose.js
 * bustSize) instead of the whole figure; `head`, angles (degrees) the head turns by; `face: false`, a code figure's
 * face left off and what painting it needs kept on the picture (`face`, for figureBustFace).
 */
function bakeFigure(Fig, clip, frame, V, ppm, outline, style = 'pixel', o = {}) {
  /* CH-4: the scene's light; CH-6: the face state (or DL-6's talk face) */
  const light = o.light || null;
  const gl = figureGl();
  if (!gl) return null;
  /* a direction (FIGURE_LOOKS) or the plain 3D figure ('smooth') */
  const LK = FIGURE_LOOKS[style] || FIGURE_LOOKS.pixel;
  /* a close-up (a portrait, a battle) gets a code figure's finer mesh; a direction may ask for more or less */
  /* (the Studio's preview keeps one detail for every picture: figurePreview) */
  const R = figureRes(gl, Fig, Fig.detail || (Fig.kind === 'code' ? (ppm >= 90 ? 2.5 : 1) * LK.detail : 1));
  if (!R) return null;
  const B = figureBaker,
    t0 = performance.now(),
    smooth = style === 'smooth',
    S = o.bust || cardSize(ppm, V.tilt, Fig.ext);
  if (S.w > B.cv.width || S.h > B.cv.height) {
    B.cv.width = Math.max(B.cv.width, S.w);
    B.cv.height = Math.max(B.cv.height, S.h);
  }
  figureTarget(gl, B.cv.width, B.cv.height);
  const code = Fig.kind === 'code',
    pose0 = code ? figurePose(Fig.F, clip, frame) : null,
    pose = pose0 && o.head ? turnHeadPose(Fig.F, pose0, o.head) : pose0,
    J = code
      ? jointMatrices(Fig.F, pose, ppm)
      : figureMeshHead(Fig, meshClipMatrices(Fig.clips[clip], frame, Fig.joints.length, ppm), o.head),
    /* the matrices the shader gets: a code figure's moving parts only (figureGpuMesh's slots) */
    JG = code && R.slots ? figureSlotMatrices(J, R.slots) : J,
    c = Math.cos(V.rel),
    s = Math.sin(V.rel);
  /* pass 0 (CH-3b): the figure's depth from the light, in the figure's turned frame; not for the plain 3D style */
  /* the scene's light (logic/figure-pose.js figureSceneLight), or the fixed top-left one (a portrait, the Studio) */
  const LT = light || FIGURE_STUDIO_LIGHT,
    LS = figureLightSpace(Fig.ext, LT.L),
    shadows = !smooth && !!B.Sh;
  if (shadows) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.smFb);
    gl.viewport(0, 0, FIGURE_SHADOW_SIZE, FIGURE_SHADOW_SIZE);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    /* pushed back a little, and looked up 3 cm out along the normal (FIGURE_VS vLS), so a surface doesn't shadow
       itself in speckles */
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 4);
    gl.useProgram(B.Sh.p);
    gl.uniformMatrix4fv(B.Sh.U.uJ, false, JG);
    gl.uniformMatrix3fv(B.Sh.U.uR, false, new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]));
    gl.uniformMatrix4fv(B.Sh.U.uLS, false, LS);
    gl.bindVertexArray(R.vao);
    if (R.indexed) gl.drawElements(gl.TRIANGLES, R.count, gl.UNSIGNED_SHORT, 0);
    else gl.drawArrays(gl.TRIANGLES, 0, R.count);
  }
  gl.disable(gl.POLYGON_OFFSET_FILL);
  /* pass 1: the figure with its depth */
  gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
  gl.viewport(0, 0, S.w, S.h);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);
  gl.depthMask(true);
  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(B.P.p);
  const U = B.P.U;
  gl.uniformMatrix4fv(U.uJ, false, JG);
  gl.uniformMatrix4fv(U.uM, false, figureClipMatrix(V.rel, V.tilt, ppm, S));
  /* the figure's turn in the camera's frame, for the normals (logic/figure-pose.js cardPoint) */
  gl.uniformMatrix3fv(U.uR, false, new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]));
  if (code) gl.uniform3fv(U.uPal, figurePalette(Fig.F, R.colours, LK.ramp, LK));
  gl.uniform1i(U.uMode, smooth ? 0 : LK.mode);
  gl.uniform1f(U.uH, Fig.height || 1.7);
  gl.uniform4fv(U.uFx, new Float32Array(LK.fx || [0, 0, 0, 0]));
  const r2 = LK.rim2 || [0, 0, 1, 0];
  gl.uniform4fv(U.uRim2, new Float32Array(light ? [...light.rim, r2[3] * light.rimK] : r2));
  gl.uniform3fv(U.uRimCol, new Float32Array(light ? light.rimCol : LK.rimCol || [255, 255, 255]));
  gl.uniform3fv(U.uL, new Float32Array(LT.L));
  gl.uniform1f(U.uFlat, LT.flat);
  /* skin: no deep tone, and no shadows from its own small forms */
  gl.uniform1i(U.uSkinC, code ? R.colours.indexOf('skin') : -1);
  gl.uniform3fv(U.uKeyT, new Float32Array(LT.keyT));
  gl.uniform3fv(U.uAmbT, new Float32Array(LT.ambT));
  gl.uniform3fv(U.uWarm, new Float32Array([255, 214, 150].map((v, i) => Math.min(255, v * LT.keyT[i]))));
  const BD = LK.bands || FIGURE_BANDS;
  gl.uniform4f(U.uB, BD.light, BD.base, BD.shine, BD.deep);
  gl.uniformMatrix4fv(U.uLS, false, LS);
  gl.uniform1f(U.uShadowOn, shadows ? 1 : 0);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, shadows ? B.smTex : null);
  gl.uniform1i(U.uSM, 2);
  gl.uniform1f(U.uTexOn, code ? 0 : 1);
  gl.uniform1f(U.uSmooth, smooth ? 1 : 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, R.tex);
  gl.uniform1i(U.uTx, 1);
  gl.bindVertexArray(R.vao);
  if (R.indexed) gl.drawElements(gl.TRIANGLES, R.count, gl.UNSIGNED_SHORT, 0);
  else gl.drawArrays(gl.TRIANGLES, 0, R.count);
  /* CH-6: the figure's depth (pass 1's alpha), read back for its face's marks: a brim or a hand in front hides them */
  let depth = null;
  if (code && Fig.F.face && Fig.F.face.length) {
    depth = new Uint8Array(S.w * S.h * 4);
    gl.readPixels(0, 0, S.w, S.h, gl.RGBA, gl.UNSIGNED_BYTE, depth);
  }
  /* pass 2: the outline, to the canvas */
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, S.w, S.h);
  gl.disable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(B.O.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, B.tex);
  gl.uniform1i(B.O.U.uT, 0);
  gl.uniform1f(B.O.U.uOut, outline && !smooth && LK.outline > 0 ? 1 : 0);
  gl.uniform1i(B.O.U.uOutW, Math.max(1, LK.outline));
  gl.uniform1f(B.O.U.uInk, LK.ink || 0);
  gl.uniform1f(B.O.U.uInner, LK.inner || 0);
  gl.uniform1f(B.O.U.uAO, LK.ao || 0);
  gl.uniform3f(B.O.U.uOL, OUTLINE_RGB[0] / 255, OUTLINE_RGB[1] / 255, OUTLINE_RGB[2] / 255);
  gl.uniform2i(B.O.U.uS, S.w, S.h);
  gl.bindVertexArray(B.oVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);
  /* the drawing buffer's rows start at the bottom: the picture is its bottom S.h rows */
  const out = makeCanvas(S.w, S.h),
    x = out.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(B.cv, 0, B.cv.height - S.h, S.w, S.h, 0, 0, S.w, S.h);
  /* a code figure's face, painted in whole pixels where its head faces the camera (logic/figure-pose.js
     figureFaceMarks); a model's face is in its texture */
  if (code && o.face === false) out.face = { F: Fig.F, J, pose, V, ppm, S, depth };
  else if (code) figurePaintFace(x, figureFaceMarks(Fig.F, J, pose, V, ppm, S, o.face || null), ppm, depth, S);
  out.ax = S.ax;
  out.ay = S.ay;
  out.ppm = ppm;
  out.noNormal = true;
  out.figure = Fig.name;
  B.bakes++;
  B.ms += performance.now() - t0;
  return out;
}
/** face marks painted on a picture's 2D context, in whole pixels (figurePaintMark), leaving out what something nearer
 * covers when the picture's depth is given (figureMarkClip)
 * @param {CanvasRenderingContext2D} x @param {ReturnType<typeof figureFaceMarks>} marks @param {number} ppm
 * @param {Uint8Array | null} [depth] @param {{ w: number, h: number }} [S] */
function figurePaintFace(x, marks, ppm, depth = null, S) {
  for (const m of marks) {
    x.fillStyle = `rgb(${m.rgb[0]},${m.rgb[1]},${m.rgb[2]})`;
    figurePaintMark(depth && S ? figureMarkClip(x, depth, S, m.d) : x, m, ppm);
  }
}
/** a model figure's joint matrices with its head turned by `head` (degrees) about its neck (DL-6); as they are with no
 * head joint or no turn. The neck is found once a figure (logic/figure-pose.js meshHeadPivot). */
function figureMeshHead(Fig, J, head) {
  if (!head || (!head.yaw && !head.pitch && !head.roll)) return J;
  if (Fig.neck === undefined) {
    const j = Fig.joints.indexOf('head'),
      p = j >= 0 ? meshHeadPivot(Fig.data, j) : null;
    Fig.neck = p ? { j, p } : null;
  }
  return Fig.neck ? turnJointAbout(J, Fig.neck.j, Fig.neck.p, head) : J;
}
/**
 * DL-6: a talk close-up of figure `name`, its head turned by `head` (degrees, the talk director's: stepped here,
 * logic/figure-pose.js headStep), in `style`: the head and shoulders BUST_PX square, seen level and a little round, in
 * its rest pose. Kept by angle; one baked every FIGURE_BUST_GAP ms at most, the rest pose before any other, and the
 * nearest kept angle given meanwhile (null until the first). A code figure's picture has no face: figureBustFace paints
 * it.
 */
export function figureBustPicture(name, head, style = 'pixel') {
  const Fig = figureDef(name);
  if (!Fig) return null;
  const smooth = style === 'smooth',
    outline = !smooth && engineSetting('people', 'outline') !== false,
    base = `${Fig.name}|${smooth ? 'smooth' : 'pixel'}|${outline ? 1 : 0}|`,
    want = headStep(head),
    got = FIGURE_BUSTS.get(base + headKey(want));
  if (got) return got;
  const rest = headStep(null),
    B = figureBaker,
    now = performance.now();
  if (now - B.bustAt >= FIGURE_BUST_GAP) {
    const h = FIGURE_BUSTS.has(base + headKey(rest)) ? want : rest,
      S = bustSize(Fig.ext),
      clip = Fig.kind === 'code' ? 'idle' : Fig.clips.idle ? 'idle' : Object.keys(Fig.clips)[0],
      ms0 = B.ms,
      im = bakeFigure(Fig, clip, 0, { rel: Math.PI - FIGURE_BUST_TURN, tilt: 0 }, S.ppm, outline, style, {
        bust: S,
        head: h,
        face: false,
      });
    B.bustAt = now;
    if (im) {
      B.busts++;
      /* the bake's own time (as `ms` counts it), not the baker's one-off start */
      B.bustMs += B.ms - ms0;
      im.head = h;
      FIGURE_BUSTS.set(base + headKey(h), im);
      while (FIGURE_BUSTS.size > FIGURE_BUST_MAX) FIGURE_BUSTS.delete(FIGURE_BUSTS.keys().next().value);
      if (h === want) return im;
    }
  }
  const kept = [];
  for (const [k, im] of FIGURE_BUSTS) if (k.startsWith(base)) kept.push(im.head);
  const near = nearestHead(want, kept);
  return near ? FIGURE_BUSTS.get(base + headKey(near)) || null : null;
}
/** DL-6: a close-up with its face at a moment (the talk director's `{eyes, mouth}`), drawn into `out` (a canvas, sized
 * to it); a model's face is its texture's, so it is copied as it is */
export function figureBustFace(out, im, state) {
  if (out.width !== im.width || out.height !== im.height) {
    out.width = im.width;
    out.height = im.height;
  }
  const x = out.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, out.width, out.height);
  x.drawImage(im, 0, 0);
  const f = im.face;
  if (f) figurePaintFace(x, figureFaceMarks(f.F, f.J, f.pose, f.V, f.ppm, f.S, state || null), f.ppm, f.depth, f.S);
  out.ppm = im.ppm;
  out.figure = im.figure;
  return out;
}
/**
 * CH-6: a painter that leaves out a mark's pixels where something nearer stands (the picture's depth, pass 1's alpha,
 * rows from the bottom): the brim of a hat over the eyes, a hand in front of the mouth
 * @param {{ fillRect: (x: number, y: number, w: number, h: number) => void }} x
 * @param {Uint8Array} depth @param {{ w: number, h: number }} S @param {number | undefined} d the mark's depth
 */
function figureMarkClip(x, depth, S, d) {
  return {
    fillRect(/** @type {number} */ mx, /** @type {number} */ my, /** @type {number} */ w, /** @type {number} */ h) {
      const hid = (/** @type {number} */ i, /** @type {number} */ j) =>
        figureMarkHidden(
          i >= 0 && j >= 0 && i < S.w && j < S.h ? depth[((S.h - 1 - j) * S.w + i) * 4 + 3] / 255 : 0,
          d
        );
      let any = false;
      for (let j = my; j < my + h && !any; j++) for (let i = mx; i < mx + w && !any; i++) any = hid(i, j);
      /* nothing in front: the rect as it is; else pixel by pixel */
      if (!any) x.fillRect(mx, my, w, h);
      else for (let j = my; j < my + h; j++) for (let i = mx; i < mx + w; i++) if (!hid(i, j)) x.fillRect(i, j, 1, 1);
    },
  };
}
/**
 * a face mark painted in whole pixels (logic/figure-pose.js figureFaceMarks): a block; a hollow one (a glasses frame)
 * its edge only, so the eye shows through; an oval (an eye, a pupil, a shine) or a smile's arc pixel by pixel, the
 * arc as thick as the density allows (a portrait's close-up gets proper shapes, not blocks)
 */
export function figurePaintMark(x, m, ppm) {
  const th = Math.max(1, Math.round(0.02 * ppm));
  if (m.shape === 'oval' || m.shape === 'arc' || m.shape === 'cap') {
    /* CH-6: a rim's own thickness (a brow's) where it has one */
    const th2 = m.shape !== 'oval' && m.t ? m.t : th;
    /* an arc is the lower rim of an ellipse centred on the mark's top, a cap the upper rim of one centred on its
       bottom, each `th` pixels thick */
    const rx = m.w / 2,
      rim = m.shape !== 'oval',
      ry = rim ? m.h : m.h / 2,
      cy = m.shape === 'arc' ? 0 : m.shape === 'cap' ? m.h : ry;
    for (let j = 0; j < m.h; j++)
      for (let i = 0; i < m.w; i++) {
        const dx = i + 0.5 - rx,
          dy = j + 0.5 - cy,
          out = (dx / rx) ** 2 + (dy / ry) ** 2 <= 1,
          inner = rim && (dx / Math.max(0.5, rx - th2)) ** 2 + (dy / Math.max(0.5, ry - th2)) ** 2 < 1;
        if (out && !inner) x.fillRect(m.x + i, m.y + j, 1, 1);
      }
    return;
  }
  /* a slant: a stroke `t` pixels thick from the top left down to the bottom right (dir 1) or the other way */
  if (m.shape === 'slant') {
    const t = Math.max(1, Math.min(m.h, m.t || th));
    for (let i = 0; i < m.w; i++) {
      const f = m.w > 1 ? i / (m.w - 1) : 0,
        y = Math.round((m.dir > 0 ? f : 1 - f) * (m.h - t));
      x.fillRect(m.x + i, m.y + y, 1, t);
    }
    return;
  }
  if (m.hollow && m.w > 2 && m.h > 2) {
    const t = Math.min(th, Math.floor((Math.min(m.w, m.h) - 1) / 2));
    x.fillRect(m.x, m.y, m.w, t);
    x.fillRect(m.x, m.y + m.h - t, m.w, t);
    x.fillRect(m.x, m.y + t, t, m.h - 2 * t);
    x.fillRect(m.x + m.w - t, m.y + t, t, m.h - 2 * t);
    return;
  }
  x.fillRect(m.x, m.y, m.w, m.h);
}
/** CH-3b: a portrait's density (pixels a metre): a head about 120 pixels wide */
const FIGURE_PORTRAIT_PPM = 160;
/** a person's figure's name in a given style (a portrait's, a snapshot's): figureFor's in the pixel style, else
 * `look:<who>#<hash>@<style>` @param {string} who @param {string} style */
function figureStyledName(who, style) {
  if (style === 'pixel') return figureFor(who);
  const w = who === 'boy' || who === 'girl' ? 'me' : who;
  return 'look:' + w + '#' + figureLookHash(typeof lookOf === 'function' ? lookOf(w) : null, w) + '@' + style;
}
/**
 * a person's portrait from their figure (the owner: the figures are also the character portraits): their head and
 * shoulders at FIGURE_PORTRAIT_PPM, turned three quarters to the camera with a slight tilt, idling (`frame` 14
 * blinks), cut from the top of their head to a little below the shoulders. A canvas, or null while the figure or the
 * baker isn't ready. Baked every call (a dialogue keeps its own).
 */
function figurePortrait(who, frame = 0, turn = 0.9, style = 'pixel') {
  const Fig = figureDef(figureStyledName(who, style));
  if (!Fig) return null;
  /* nearly level (4 degrees), so a brim doesn't hide the face */
  const V = figureView(Math.PI * turn, 0, (4 * Math.PI) / 180, 32),
    im = bakeFigure(Fig, 'idle', frame, V, FIGURE_PORTRAIT_PPM, true, style);
  if (!im) return null;
  /* from the first row with anything on it (a top hat's crown and all) down to just under the shoulders (the kit's
     `bust`, metres from the ground; Kappi, with no kit, whole) */
  const out = figureBust(im, Fig, FIGURE_PORTRAIT_PPM);
  out.figure = Fig.name;
  return out;
}
/** CH-5b: the direction the Studio's preview dresses by: the style's, with flair `flair` on (the Flair tab)
 * @param {string} style @param {string} [flair] */
function figurePreviewLook(style, flair) {
  const LK = FIGURE_LOOKS[style] || FIGURE_LOOKS.pixel,
    own = figureDesign(style) ? LK : null;
  if (!flair) return own;
  return { ...(own || {}), flair: { ...((own && own.flair) || {}), [flair]: true } };
}
/** CH-5: the figure the Studio's preview shows (figurePreview): its name, its figure and how long it took to build */
const figurePreviewState = { name: '', def: /** @type {any} */ (null), ms: 0, face: '' };
/**
 * CH-5: the Studio's figure preview: a person's figure built from a look with the Studio's kit data (figureKit.json as
 * it is edited), baked in the studio light, turned `turn` (0 from behind, 1 facing you), as a canvas; null when the
 * baker can't draw. The figure is built again only when `rev` (the Studio's count of its edits), the person or the
 * style changes; its mesh is built on the page, the old one let go. `o`: look, items (the wardrobe's), kit, who (the
 * person: their seed and a direction's design for them), figure (their head and build), rev, style, clip ('idle'),
 * frame, turn (0.9), tilt (radians, 4 degrees), ppm (64), crop ('whole' or 'bust'). The canvas carries `ms`, the
 * figure's build time, and `kit`, the head shape and build it has. CH-6: a change of the face alone (`faceRev`, the
 * Studio's count of its face edits, or the figure's eye and brow styles) paints the face again on the same mesh.
 * CH-5b: `flair` turns that flair of the kit's on (the Studio's Flair tab; part of `rev`).
 * @param {{ look: any, items: any, kit: any, who?: string, figure?: any, rev?: number, faceRev?: number,
 *   flair?: string, face?: { expr?: string, talk?: number, blink?: number, mouth?: string, eyes?: string }, style?: string, clip?: string, frame?: number, turn?: number, tilt?: number, ppm?: number, crop?: string }} o
 */
export function figurePreview(o) {
  const style = o.style && (o.style === 'smooth' || o.style in FIGURE_LOOKS) ? o.style : 'pixel',
    LK = FIGURE_LOOKS[style] || FIGURE_LOOKS.pixel,
    who = o.who || 'preview',
    name = 'preview:' + who + ':' + (o.rev || 0) + '@' + style,
    P = figurePreviewState;
  if (P.name !== name) {
    figurePreviewForget();
    const detail = LK.detail || 1,
      look0 = figurePreviewLook(style, o.flair),
      F = figureFromLook(name, who, o.look, look0, o.items, o.kit, o.figure),
      t0 = performance.now(),
      M = kitBuild(F, detail);
    figureMeshKeep(name + '|' + detail, M);
    P.ms = performance.now() - t0;
    P.name = name;
    P.def = { kind: 'code', name, F, height: F.height, ext: M.ext, detail };
    P.face = '';
  }
  const fig = o.figure || {},
    face = JSON.stringify([fig.eyes, fig.brows, o.faceRev || 0]);
  if (P.face && P.face !== face) {
    /* the face's marks and colours from the edited data, on the mesh already built */
    const F2 = figureFromLook(name, who, o.look, figurePreviewLook(style, o.flair), o.items, o.kit, o.figure);
    P.def.F.face = F2.face;
    Object.assign(P.def.F.colours, F2.colours);
  }
  P.face = face;
  const ppm = o.ppm || 64,
    V = figureView(Math.PI * (o.turn ?? 0.9), 0, o.tilt ?? (4 * Math.PI) / 180, 32);
  /* CH-6: a face state (an expression, a talking frame, a blink) */
  const st = o.face && P.def.F.faceSet ? figureFaceState(P.def.F, o.face) : null;
  let im = bakeFigure(P.def, o.clip || 'idle', o.frame || 0, V, ppm, true, style, { face: st });
  if (im && o.crop === 'bust') im = figureBust(im, P.def, ppm);
  if (!im) return null;
  im.ms = Math.round(P.ms);
  im.kit = P.def.F.kit || null;
  return im;
}
/** CH-5: let the preview's figure go (its GPU mesh; its built mesh ages out of figure-meshes.js) */
function figurePreviewForget() {
  const P = figurePreviewState,
    B = figureBaker,
    gl = B.gl;
  if (!P.name) return;
  for (const [k, R] of B.res)
    if (k === P.name || k.startsWith(P.name + '|')) {
      if (gl && !gl.isContextLost()) {
        gl.deleteVertexArray(R.vao);
        if (R.vb) gl.deleteBuffer(R.vb);
      }
      B.res.delete(k);
    }
  P.name = '';
  P.def = null;
}
/** CH-4: the snapshots kept (figureSnapshot), the longest unused let go past this many */
const FIGURE_SNAP_MAX = 48;
const FIGURE_SNAPS = new Map();
/**
 * CH-4's snapshot service: a picture of a person's figure for the UI (the dressing room, a dialogue, a card), lit in
 * the fixed studio light, as a canvas, kept by what it shows. `o`: clip ('idle'), frame (0), turn (0.9: three quarters;
 * 0 from behind, 1 facing you), tilt (radians, 4 degrees), ppm (FIGURE_PORTRAIT_PPM), style (Engine > People > Figure
 * style) and crop: 'bust' (head and shoulders, figurePortrait's cut) or 'whole'. Null while the figure's mesh is built
 * (figure-meshes.js) or the baker can't draw: ask again. The live atlas is unlit, so these come from the figure baker's
 * own context, which already lights a picture whole (a canvas the page can keep, draw and save without the game's
 * renderer).
 */
function figureSnapshot(who, o = {}) {
  const style = o.style || figureStyle(),
    clip = o.clip || 'idle',
    frame = o.frame || 0,
    turn = o.turn ?? 0.9,
    tilt = o.tilt ?? (4 * Math.PI) / 180,
    ppm = o.ppm || FIGURE_PORTRAIT_PPM,
    crop = o.crop === 'whole' ? 'whole' : 'bust',
    name = figureStyledName(who, style),
    key = [name, clip, frame, turn, Math.round(tilt * 1000), ppm, crop, style].join('|');
  let im = FIGURE_SNAPS.get(key);
  if (im) {
    FIGURE_SNAPS.delete(key);
    FIGURE_SNAPS.set(key, im);
    return im;
  }
  const Fig = figureDef(name);
  if (!Fig) return null;
  im = bakeFigure(Fig, clip, frame, figureView(Math.PI * turn, 0, tilt, 32), ppm, true, style);
  if (im && crop === 'bust') im = figureBust(im, Fig, ppm);
  if (!im) return null;
  im.figure = Fig.name;
  FIGURE_SNAPS.set(key, im);
  while (FIGURE_SNAPS.size > FIGURE_SNAP_MAX) FIGURE_SNAPS.delete(FIGURE_SNAPS.keys().next().value);
  return im;
}
/** a baked picture cut from the first row with anything on it down to just under the shoulders (the kit's `bust`) */
function figureBust(im, Fig, ppm) {
  const x = im.getContext('2d'),
    d = x.getImageData(0, 0, im.width, im.height).data;
  let top = 0;
  findTop: for (; top < im.height; top++)
    for (let i = 0; i < im.width; i++) if (d[(top * im.width + i) * 4 + 3] > 0) break findTop;
  const bust = Fig.F && Fig.F.kit && Fig.F.kit.bust != null ? Fig.F.kit.bust : 0,
    h = Math.max(8, Math.min(im.height - top, Math.round(im.ay - bust * ppm) - top)),
    out = makeCanvas(im.width, h);
  out.getContext('2d').drawImage(im, 0, top, im.width, h, 0, 0, im.width, h);
  return out;
}
/**
 * the picture of a person drawn as a figure this frame, or their last one while it isn't baked yet (null when there
 * is none). `rec` is what the last picture is kept against (a runtime record or a lineup entry, never written to);
 * `heading` the way they face in the world (logic/person-view.js personHeading), `yaw` the camera's turn (seenYaw),
 * `tilt` the camera's tilt, `style` 'pixel' or 'smooth' (the plain 3D figure, baked at FIGURE_SMOOTH_PPM); a pixel
 * figure at `ppmAt` pixels a metre if given (a battle's), else at the dial's.
 */
function figurePicture(rec, name, clip, frame, heading, yaw, tilt, style = 'pixel', ppmAt = 0, at = null, face = null) {
  const Fig = figureDef(name);
  let im = null;
  if (Fig) {
    const e = k => engineSetting('people', k),
      smooth = style === 'smooth',
      ppm = smooth ? FIGURE_SMOOTH_PPM : ppmAt || Math.max(16, Math.min(64, Math.round(e('density') || 32))),
      ys = e('yawSteps') || 16,
      steps = ys >= 32 ? 32 : ys >= 16 ? 16 : 8,
      outline = !smooth && e('outline') !== false,
      V = figureView(heading, yaw, tilt, steps),
      /* CH-3b: lit by the scene (its sun, sky and lamps), kept by that light too */
      light = smooth ? null : figureLightNow(at),
      /* CH-6: the face's state (an expression, talking, a blink), part of the picture's name when not at rest */
      FS = Fig.kind === 'code' ? figureFaceState(Fig.F, face || {}) : null,
      fk = FS && FS.key ? '|' + FS.key : '',
      key = figureKey(Fig.name, clip, frame, V, steps, ppm, outline, style + (light ? '~' + light.key : '')) + fk;
    /* CH-4: the live atlas (figure-atlas.js): a kit figure in the world drawn by the game's renderer each step and
       lit where it stands (not a battle's close-up, nor the plain 3D style, which keep their baked pictures) */
    if (!ppmAt && !smooth && Fig.kind === 'code' && typeof figureAtlasOn === 'function' && figureAtlasOn()) {
      const p = figureAtlasPicture(rec, Fig, clip, frame, V, steps, figureFarPpm(rec, ppm, at), outline, style, FS);
      if (p) {
        if (rec && typeof rec === 'object') figureLast.set(rec, p);
        return p;
      }
      return rec && typeof rec === 'object' ? figureLast.get(rec) || null : null;
    }
    im = FIGURE_CACHE.get(key) || null;
    if (im) {
      /* kept the longest by the last use */
      FIGURE_CACHE.delete(key);
      FIGURE_CACHE.set(key, im);
    } else {
      const B = figureBaker,
        fr = typeof gpuState !== 'undefined' ? gpuState.fr || 0 : 0;
      if (B.frame !== fr) {
        B.frame = fr;
        B.frameBakes = 0;
      }
      /* the first bake of a frame always (so a figure shows up), more only while the frame's one-off work budget
         lasts (walk/quality-cull.js frameBudgetLeft, the load track's): a bake reads its picture back, which waits on
         the graphics card */
      if (
        B.frameBakes < FIGURE_BAKES_A_FRAME &&
        (B.frameBakes === 0 || typeof frameBudgetLeft !== 'function' || frameBudgetLeft())
      ) {
        B.frameBakes++;
        im = bakeFigure(Fig, clip, frame, V, ppm, outline, style, { light, face: FS });
        if (im) {
          FIGURE_CACHE.set(key, im);
          B.bytes += im.width * im.height * 4;
          /* the longest unused go first, past the count or the bytes */
          while (FIGURE_CACHE.size > FIGURE_CACHE_MAX || (B.bytes > FIGURE_CACHE_BYTES && FIGURE_CACHE.size > 1)) {
            const k = FIGURE_CACHE.keys().next().value,
              old = FIGURE_CACHE.get(k);
            B.bytes -= old.width * old.height * 4;
            FIGURE_CACHE.delete(k);
          }
        }
      }
    }
  }
  if (im && rec && typeof rec === 'object') figureLast.set(rec, im);
  return im || (rec && typeof rec === 'object' ? figureLast.get(rec) || null : null);
}
/** CH-4: each person's density step (logic/figure-pose.js figureDensityStep), kept so it holds near an edge */
const figureDensity = new WeakMap();
/**
 * CH-4: density by distance: the dial's pixels a metre for a person standing at `at` (world x, z), stepped down by how
 * much farther from the camera they stand than its target; the dial's own without a place or a camera
 */
function figureFarPpm(rec, ppm, at) {
  const C = typeof walkView !== 'undefined' ? walkView.C : null;
  if (!at || !C || !C.eye || !(C.df > 0) || !rec || typeof rec !== 'object') return ppm;
  const y = typeof standingHeightAt === 'function' ? standingHeightAt(at[0], at[1]) + 1 : 1,
    d = Math.hypot(at[0] - C.eye[0], y - C.eye[1], at[1] - C.eye[2]),
    k = figureDensityStep(C.df / Math.max(0.01, d), figureDensity.get(rec));
  figureDensity.set(rec, k);
  return Math.max(16, Math.round((ppm * k) / 4) * 4);
}
/** each person's movement at the last tick of the 12 fps clock (CH-3c: logic/figure-pose.js figureMotion: how far
 * they went, their speed and gait, when they set off and stopped, the way they face, eased) */
const figureGait = new WeakMap();
/** CH-3c: the ticks people spent in each way of moving (the debug log's figures line: walk, jog, sprint, start, stop) */
const figureMoves = { walk: 0, jog: 0, sprint: 0, start: 0, stop: 0 };
/** CH-3c: each kit figure's cycle a gait (figure-pose.js figureStride), worked out once */
const figureStrides = new WeakMap();
/** @param {any} F a code figure @param {string} kind @returns {number} metres a cycle */
function figureCycle(F, kind) {
  let S = figureStrides.get(F);
  if (!S) figureStrides.set(F, (S = {}));
  return S[kind] || (S[kind] = figureStride(F, kind).cycle);
}
/** the camera's tilt this frame (walk/camera.js), radians; the Normal zoom's 26 degrees with no camera */
function figureTilt() {
  const C = typeof walkView !== 'undefined' ? walkView.C : null;
  return C && C.sp != null ? Math.atan2(C.sp, C.cp) : (26 * Math.PI) / 180;
}
/**
 * CH-6: the face a person shows now from the dialogue box (talk.js talkBox): while the line on it is theirs, its
 * expression and a talking mouth (figure-pose.js figureTalkFace); null otherwise. `who` is what the line names (a
 * person or look id, 'folk:<seed>', 'me'); a person in the world at (x, z) must also be the one talked to (near
 * walkRenderer.talkAt: two people may share a look); a cutscene's actor passes no place
 * @param {string | null | undefined} who @param {number} [x] @param {number} [z] @param {boolean} [me] you
 * @returns {{ expr: string | null, talk?: number } | null}
 */
export function figureFaceFor(who, x, z, me = false) {
  const T = typeof talkBox !== 'undefined' ? talkBox : null,
    c = T && T.on ? T.cur : null;
  if (!c || !who || !(c.who === who || (me && c.who === 'me'))) return null;
  const at = !me && x != null && typeof walkRenderer !== 'undefined' ? walkRenderer.talkAt : null;
  if (at && z != null && Math.hypot(x - at.x, z - at.z) > FIGURE_TALK_NEAR) return null;
  return figureTalkFace({
    expr: T.por && T.por.who === c.who ? T.por.expr : null,
    text: c.text,
    n: c.n,
    typing: c.typing,
    t: performance.now(),
    reduced: reducedMotion,
  });
}
/** CH-6: how far (metres) from where the talk began the one talking may stand */
const FIGURE_TALK_NEAR = 1.5;
/**
 * a person drawn as figure `name` this frame, doing `act`: 'idle', 'walk' or 'run', or another of the figure's clips
 * ('cheer', 'throw', 'sit'); turned toward `heading` in the world (logic/person-view.js personHeading), seen from
 * this frame's camera, in `style`. CH-3c: a kit figure moves by how far it went a tick (`gait`, the caller's count of
 * metres walked when above 0, else how far `at` moved: logic/figure-pose.js figureMotion), walking, jogging or
 * sprinting by its speed with its feet where it put them, stepping off and settling, and turning to a new heading
 * over a few ticks (a figure from a model too). `rec` keeps their last picture and their movement (nothing is written
 * on it). Null until a first picture is baked (or while a model's file loads).
 */
export function figurePersonPicture(rec, name, t, act, gait, heading, style = 'pixel', at = null, face = null) {
  const Fig = figureDef(name);
  if (!Fig) return rec && typeof rec === 'object' ? figureLast.get(rec) || null : null;
  const tick = figureTick(t),
    code = Fig.kind === 'code',
    quad = code && Fig.F.parts.some((/** @type {any} */ p) => p.id === 'legFL'),
    was = figureGait.get(rec),
    M = figureMotion(was, {
      tick,
      gait,
      at,
      heading,
      cycle: kind => (code ? figureCycle(Fig.F, quad ? 'walk' : kind) : WALK_CYCLE_M),
    });
  figureGait.set(rec, M);
  let clip = act,
    frame;
  if (code) {
    /* CH-3b: a kit figure cheers and sits too; each breathes at its own time, not in step with the crowd */
    const moves = act === 'cheer' || act === 'sit' || act === 'throw' ? null : figureMotionClip(M, quad);
    if (moves && M !== was && moves.clip in figureMoves)
      figureMoves[/** @type {keyof typeof figureMoves} */ (moves.clip)]++;
    clip = moves ? moves.clip : act === 'cheer' || act === 'sit' || act === 'throw' ? act : 'idle';
    frame = moves ? moves.frame : clipFrameAt(clip, t + (figureSeed(name) % 2700));
  } else {
    if (!Fig.clips[clip]) clip = act === 'run' && Fig.clips.walk ? 'walk' : 'idle';
    if (!Fig.clips[clip]) clip = Object.keys(Fig.clips)[0];
    const speed = clip === 'run' ? WALK_SPEED * RUN_FACTOR : WALK_SPEED;
    frame = meshClipFrame(Fig.clips[clip], t, M.gait, speed);
  }
  /* CH-6: everyone blinks on the portrait kit's timing (a kit figure: walking too), each at their own time */
  const blink = code && Fig.F.faceSet ? figureBlinkAt(t, figureSeed(name)) : 0,
    fc = blink ? { ...(face || {}), blink } : face;
  return figurePicture(rec, name, clip, frame, M.head, seenYaw(), figureTilt(), style, 0, at, fc);
}
/**
 * a battle's trainer drawn as your figure (battle-stage.js trainerBattleFrame): you from behind (i 0) or the rival
 * facing you (i 1), at FIGURE_BATTLE_PPM, square to the battle's level camera; an act of the figure's own (the throw:
 * by how far through it the battle is, `progress` 0..1), else its idle by the clock. `rec` keeps their last picture.
 */
function figureBattlePicture(rec, i, t, act, progress) {
  /* CH-3b: you as your figure, the rival as theirs (`who`, its look through the figure kit) */
  const name = i === 0 ? figureFor('me') : figureFor(rec && rec.who ? rec.who : 'me'),
    Fig = figureDef(name);
  if (!Fig) return rec && typeof rec === 'object' ? figureLast.get(rec) || null : null;
  const C = Fig.kind === 'mesh' ? Fig.clips : null;
  let clip = 'idle',
    frame;
  if (Fig.kind === 'code' && (act === 'throw' || act === 'cheer')) {
    clip = act;
    frame = act === 'throw' ? Math.min(7, Math.floor((progress || 0) * 8)) : clipFrameAt('cheer', t);
  } else if (act && C && C[act]) {
    clip = act;
    frame = Math.max(0, Math.min(C[act].frames - 1, Math.floor((progress || 0) * C[act].frames)));
  } else {
    if (C && !C.idle) clip = Object.keys(C)[0];
    frame = C ? meshClipFrame(C[clip], t, 0, 0) : clipFrameAt('idle', t + (figureSeed(name) % 2700));
  }
  return figurePicture(rec, name, clip, frame, i === 0 ? 0 : Math.PI, 0, 0, figureStyle(), FIGURE_BATTLE_PPM);
}
/** the baker's numbers for the debug log's people section (numbers only) */
export function figureReport() {
  const B = figureBaker;
  const e = k => (typeof engineSetting === 'function' ? engineSetting('people', k) : null);
  return {
    on: figuresOn(),
    figure: figureChoice(),
    looks: Object.keys(FIGURE_DEFS).filter(k => k.startsWith('look:') && FIGURE_DEFS[k]).length,
    /* CH-5: the kit data's revision the figures are built from, and whether it is the Studio's */
    kit: figureKitRevision() + (figureKitState.own ? ' (own)' : ''),
    style: figureStyle(),
    density: e('density'),
    turns: e('yawSteps'),
    folk: figureFolk(),
    pictures: FIGURE_CACHE.size,
    mb: Math.round((B.bytes / 1048576) * 10) / 10,
    bakes: B.bakes,
    ms: Math.round(B.ms * 10) / 10,
    /* DL-6: the talk's close-ups kept, baked, and their bakes' time (ms, also in `ms`) */
    busts: FIGURE_BUSTS.size,
    bustBakes: B.busts,
    bustMs: Math.round(B.bustMs * 10) / 10,
    lost: B.lost,
    losses: B.losses,
    failed: B.failed || null,
    figures: Object.keys(FIGURE_DEFS).filter(k => FIGURE_DEFS[k]).length,
    /* CH-4: the meshes' helper thread: its builds and their ms, any built on the page, waiting, kept */
    meshes: figureMeshReport(),
    /* CH-4: the live atlas: people in it, cells, draws and their ms */
    atlas: typeof figureAtlasReport === 'function' ? figureAtlasReport() : null,
    /* CH-3c: the ticks people spent walking, jogging, sprinting, stepping off and settling */
    moves: { ...figureMoves },
  };
}
/** the checks: lose the baker's context on purpose, back after `ms` (WEBGL_lose_context); false if it can't */
function figureBakerLose(ms = 1500) {
  const gl = figureBaker.gl,
    x = gl && gl.getExtension('WEBGL_lose_context');
  if (!x) return false;
  x.loseContext();
  setTimeout(() => x.restoreContext(), ms);
  return true;
}
/** forget every baked picture (the checks; a picture already in the world stays drawn until it's replaced) */
function figureCacheClear() {
  FIGURE_CACHE.clear();
  FIGURE_BUSTS.clear();
  figureBaker.bytes = 0;
}
