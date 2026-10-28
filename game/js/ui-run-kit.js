'use strict';
/* ================= UI KIT: THE RUN PARTS (UI track UI-4) =================
   The parts the run's screens build from (docs/phases/ui-track.md, UI-4), so RL-7 and RL-8 need no CSS of their own.
   Lit web components like js/ui-kit.js, on its tokens only; nothing in the game uses them yet (the UI gallery shows
   every state). Values come in as attributes or properties: no game data is read here, so the currency and node
   names stay the caller's (currencies.json and nodeTypes.json come later).
     <pb-day-chip day="3">                            "Day 3" (RL-R2: the owner dropped the deadline)
     <pb-forecast items="clear:Clear,rain:Rain" from="3" value="3">   the weather by day, today marked
     <pb-node type="town" state="seen" weather="rain" label="Marrow Town">   a run map marker (js/logic/run-marks.js)
     <pb-coin kind="money|research|scrap|crests|beans|dna" value="340" label="Moneys">   a currency chip that counts to a new value
     <pb-pick-card heading="..." facedown selected rarity="rare">   the relic pick and keep-one card; turning it face up
                                                       flips it; UI-14a: rarity shows as a frame, pill and name colour
     <pb-payout rows='[{"label":"Moneys left","value":170}]' total="420" total-label="Research">   rows slam in, the
                                                       total counts up (play() runs it again); pb-payout-row
                                                       as each row shows, pb-payout-total as the total lands
     <pb-nav-bar set="run|hub" value="map" badges="perks:2" compact>   the bottom bar (pb-change); UI-8: the minimap
                                                       tile in the middle (slot "map"), compact while walking
     <pb-loading heading="..." sub="..." tip="..." value="0.4" stages='[{"id":"map","label":"...","state":"ready"}]'>
                                                       HB-2: the run's loading screen; slot "view" for its picture
     <pb-stamp word="DENIED" tilt="-8" size="sm|lg" still>   SY-3: the Bureau's stamp, slammed on (pb-stamp-land as it
                                                       lands); the words are factions.json look.stamps
   The motions here repeat css/motion.css's reward motions (m-slam, m-flip), as a component's styles can't see the
   page's; with reduced motion each one is a fade and numbers jump to their end. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { i18nText } from './hooks.js';
import { glyphOf, sigVar } from './logic/signals.js';
import { chipLook, rarityTier } from './logic/marks.js';
import { motionCountAt, motionCountMs } from './logic/motion.js';
import { RUN_MARK_ART, runMarkLook, runMarkPixels } from './logic/run-marks.js';
import { LitElement, css, html, nothing, pbSlideBar, pbSound, reduced } from './ui-kit.js';
expose({
  PbCoin: [() => PbCoin],
  PbDayChip: [() => PbDayChip],
  PbForecast: [() => PbForecast],
  PbLoading: [() => PbLoading],
  PbNavBar: [() => PbNavBar],
  PbNode: [() => PbNode],
  PbPayout: [() => PbPayout],
  PbPickCard: [() => PbPickCard],
  PbStamp: [() => PbStamp],
  RUN_CURRENCY_ICONS: [() => RUN_CURRENCY_ICONS],
  RUN_NAV_SETS: [() => RUN_NAV_SETS],
  RUN_WEATHER_ICONS: [() => RUN_WEATHER_ICONS],
  navStep: [() => navStep],
  runIcon: [() => runIcon],
  runIconPixels: [() => runIconPixels],
  runIconPx: [() => runIconPx],
  runIconURL: [() => runIconURL],
  runKitBase: [() => runKitBase],
  runKitMotion: [() => runKitMotion],
  runList: [() => runList],
  runMsVar: [() => runMsVar],
  runNumber: [() => runNumber],
  runSvg: [() => runSvg],
  unsafeCSS: [() => unsafeCSS],
});
/* to-module: end */
/* Lit's html, css, LitElement and nothing, and reduced(), come from js/ui-kit.js (one name each on the page) */
const runSvg = /** @type {any} */ (self).PB_LIT.svg;
const unsafeCSS = /** @type {any} */ (self).PB_LIT.unsafeCSS;

/* a UI icon (game/art/ui/<key>.svg), fixed-colour pixel art shown as an image, found as art.js finds it (the bundled
   build inlines them in NW_ART; a page outside game/ sets NW_ARTDIR) */
export const runIconURL = (/** @type {string} */ k) => {
  const w = /** @type {any} */ (self);
  return (w.NW_ART && w.NW_ART[`ui/${k}.svg`]) || new URL(`${w.NW_ARTDIR || 'art/'}ui/${k}.svg`, document.baseURI).href;
};
const runIcon = (/** @type {string} */ k, cls = 'ic') =>
  html`<i class=${cls} style="--ico:url('${runIconURL(k)}')" aria-hidden="true"></i>`;
/** a CSS time token in ms (--m-slow: 360ms), read where the part sits so uiTheme.json's motion dials reach it */
const runMsVar = (/** @type {Element} */ el, /** @type {string} */ name, dflt) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : n) : dflt;
};
/** numbers as the game writes them: 12,400 */
export const runNumber = (/** @type {number} */ n) => Math.round(n).toLocaleString('en-US');

/* the weather's icons and names (environment.js WEATHER_NAMES gives the game's; these are the fallbacks) */
const RUN_WEATHER_ICONS = {
  clear: 'sun',
  cloudy: 'cloud',
  rain: 'rain',
  storm: 'bolt',
  fog: 'fog',
  snow: 'snow',
  ash: 'ash',
};
/* the six currencies' icons (names are placeholders until currencies.json, roguelite-track.md 8.5) */
const RUN_CURRENCY_ICONS = {
  money: 'coin',
  research: 'research',
  scrap: 'scrap',
  crests: 'crest',
  beans: 'bean',
  dna: 'dna',
};
/* the bottom bar's two sets (owner's decision: one bar whose tabs change); Map is the minimap tile (UI-8) */
const RUN_NAV_SETS = {
  run: [
    { id: 'map', label: 'Map', icon: 'map' },
    { id: 'team', label: 'Team', icon: 'team' },
    { id: 'guide', label: 'Guide', icon: 'ledger' },
    { id: 'bag', label: 'Bag', icon: 'bag' },
    { id: 'perks', label: 'Perks', icon: 'relic' },
  ],
  hub: [
    { id: 'map', label: 'Map', icon: 'map' },
    { id: 'team', label: 'Team', icon: 'team' },
    { id: 'guide', label: 'Guide', icon: 'ledger' },
    { id: 'bag', label: 'Bag', icon: 'bag' },
    { id: 'lab', label: 'Lab', icon: 'spark' },
  ],
};
/** "a:A,b:B" or a list of {id, label} @param {any} it */
const runList = it =>
  Array.isArray(it)
    ? it
    : String(it || '')
        .split(',')
        .filter(Boolean)
        .map(s => {
          const [id, label] = s.split(':');
          return { id: id.trim(), label: (label || id).trim() };
        });

/* shared: the voice font, the icon mask, focus */
const runKitBase = css`
  :host {
    box-sizing: border-box;
    font-family: var(--font-voice);
    color: var(--text);
  }
  :host([hidden]) {
    display: none;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  :focus-visible {
    outline: 3px solid color-mix(in srgb, var(--gold-b) 70%, white);
    outline-offset: 2px;
  }
  .ic {
    display: inline-block;
    flex: none;
    width: 18px;
    height: 18px;
    background: var(--ico) center / contain no-repeat;
  }
`;
/* the reward motions (css/motion.css m-slam, m-flip), repeated for the shadow styles */
export const runKitMotion = css`
  @keyframes m-slam {
    from {
      opacity: 0;
      transform: translateX(28px) scale(1.12);
    }
    60% {
      opacity: 1;
      transform: translateX(-3px) scale(0.98);
    }
  }
  @keyframes m-flip {
    from {
      transform: perspective(600px) rotateY(180deg);
    }
  }
  @keyframes m-fade {
    from {
      opacity: 0;
    }
  }
  @keyframes m-count {
    40% {
      transform: scale(1.12);
    }
  }
`;

/* ---------- the day chip (RL-R2: the owner dropped the deadline; the day clock stays) ---------- */
const PbDayChip = class extends LitElement {
  static properties = { day: { type: Number } };
  static styles = [
    runKitBase,
    css`
      :host {
        display: inline-block;
        --tone: var(--c-surface);
        --ink: var(--text);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--s2);
        min-height: 32px;
        padding: var(--s1) calc(var(--s3) + 6px);
        clip-path: var(--clip-chip);
        background: var(--tone);
        color: var(--ink);
        font-size: 17px;
        line-height: 1;
        white-space: nowrap;
      }
      b {
        font-weight: 400;
        font-size: 20px;
      }
    `,
  ];
  constructor() {
    super();
    this.day = 1;
  }
  render() {
    return html`<span class="chip" role="status" aria-label=${`Day ${this.day}`}
      >${runIcon('clock')}<span>Day <b>${this.day}</b></span></span
    >`;
  }
};

/* ---------- the forecast: the weather day by day ---------- */
const PbForecast = class extends LitElement {
  static properties = { items: {}, from: { type: Number }, value: { type: Number }, label: {} };
  static styles = [
    runKitBase,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      ol {
        display: flex;
        gap: var(--s1);
        margin: 0;
        padding: 0;
        list-style: none;
        overflow-x: auto;
        scrollbar-width: none;
      }
      li {
        display: grid;
        justify-items: center;
        gap: 2px;
        flex: none;
        width: 44px;
        padding: var(--s1) 0 var(--s2);
        clip-path: var(--clip-button);
        background: color-mix(in srgb, var(--text) 7%, transparent);
        color: var(--text2);
      }
      li .ic {
        width: 22px;
        height: 22px;
        color: var(--text);
      }
      li span {
        font-size: 13px;
        line-height: 1;
      }
      li[aria-current='date'] {
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
        color: var(--goldink, #3a2408);
      }
      li[aria-current='date'] .ic {
        color: var(--goldink, #3a2408);
      }
    `,
  ];
  constructor() {
    super();
    this.items = [];
    this.from = 1;
    this.value = 0;
    this.label = 'Forecast';
  }
  render() {
    return html`<ol aria-label=${this.label}>
      ${runList(this.items).map((w, i) => {
        const day = this.from + i,
          k = /** @type {any} */ (RUN_WEATHER_ICONS)[w.id] || 'cloud';
        return html`<li aria-current=${day === this.value ? 'date' : nothing} aria-label=${`Day ${day}: ${w.label}`}>
          <span aria-hidden="true">${day}</span>${runIcon(k)}
        </li>`;
      })}
    </ol>`;
  }
};

/* ---------- a run map marker ---------- */
/** UI-8c: a UI icon's pixels (36 x 36 RGBA), loaded once each */
const runIconPx = /** @type {Record<string, Promise<Uint8ClampedArray>>} */ ({});
const runIconPixels = (/** @type {string} */ k) =>
  runIconPx[k] ||
  (runIconPx[k] = new Promise((ok, no) => {
    const im = new Image(),
      N = RUN_MARK_ART.grid;
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      x.drawImage(im, 0, 0, N, N);
      ok(x.getImageData(0, 0, N, N).data);
    };
    im.onerror = no;
    im.src = runIconURL(k);
  }));
/* UI-8c: the place's pixel icon (art/ui/node-<shape>.svg, Badges) for its state, painted as the bowl paints it
   (logic/run-marks.js runMarkPixels: the gold rim where you stand, done faded with a check, locked grey with a
   padlock); --size is the icon's 36 grid, the rim reaches two art pixels past it */
const PbNode = class extends LitElement {
  static properties = { type: { reflect: true }, state: { reflect: true }, weather: {}, label: {} };
  static styles = [
    runKitBase,
    css`
      :host {
        --size: 36px;
        display: inline-grid;
        position: relative;
        width: var(--size);
        height: var(--size);
      }
      canvas {
        position: absolute;
        left: calc(var(--size) / -18);
        top: calc(var(--size) / -18);
        width: calc(var(--size) * 40 / 36);
        height: calc(var(--size) * 40 / 36);
        image-rendering: pixelated;
      }
      :host([state='current']) canvas {
        filter: drop-shadow(0 0 calc(var(--size) / 8) color-mix(in srgb, var(--gold-a) 80%, transparent));
      }
      .wx {
        position: absolute;
        right: -6px;
        top: -6px;
        display: grid;
        place-items: center;
        width: 20px;
        height: 20px;
        clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        background: var(--c-surface);
        color: var(--c-text);
      }
      .wx .ic {
        width: 12px;
        height: 12px;
      }
    `,
  ];
  constructor() {
    super();
    this.type = 'route';
    this.state = 'seen';
    this.weather = '';
    this.label = '';
    /** the picture drawn once its icons have loaded (a promise, for the gallery's pictures) */
    this.painted = Promise.resolve();
  }
  get look() {
    return runMarkLook(this.type, this.state);
  }
  updated() {
    const L = this.look,
      state = this.state,
      cv = /** @type {HTMLCanvasElement | null} */ (this.renderRoot.querySelector('canvas'));
    if (!cv) return;
    this.painted = Promise.all([runIconPixels(L.icon), L.badge ? runIconPixels(L.badge) : null])
      .then(([icon, badge]) => {
        if (this.look.icon !== L.icon || this.state !== state) return;
        const p = runMarkPixels(icon, badge, state);
        cv.width = p.w;
        cv.height = p.h;
        /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')).putImageData(
          new ImageData(p.data, p.w, p.h),
          0,
          0
        );
      })
      .catch(() => {});
  }
  render() {
    const wx = this.weather && this.state !== 'hidden' && /** @type {any} */ (RUN_WEATHER_ICONS)[this.weather],
      said =
        this.state === 'hidden'
          ? 'Not yet seen'
          : [this.label || this.type, this.state !== 'seen' ? this.state : '', this.weather].filter(Boolean).join(', ');
    return html`<span role="img" aria-label=${said} style="display:contents"
      ><canvas width="40" height="40" aria-hidden="true"></canvas>${
        wx ? html`<span class="wx" aria-hidden="true">${runIcon(wx)}</span>` : nothing
      }</span
    >`;
  }
};

/* ---------- a currency chip ---------- */
export const PbCoin = class extends LitElement {
  static properties = { kind: { reflect: true }, value: { type: Number }, label: {}, _shown: { state: true } };
  static styles = [
    runKitBase,
    runKitMotion,
    css`
      :host {
        display: inline-block;
        --tone: var(--gold-b);
      }
      :host([kind='research']) {
        --tone: var(--c-primary);
      }
      :host([kind='scrap']) {
        --tone: color-mix(in srgb, var(--c-text) 55%, var(--c-surface));
      }
      :host([kind='crests']) {
        --tone: var(--c-danger);
      }
      :host([kind='dna']) {
        --tone: var(--c-primary);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--s2);
        min-height: 32px;
        padding: var(--s1) calc(var(--s3) + 6px) var(--s1) calc(var(--s2) + 6px);
        clip-path: var(--clip-chip);
        background: color-mix(in srgb, var(--tone) 16%, var(--c-surface));
        white-space: nowrap;
      }
      .ic {
        color: var(--tone);
        width: 20px;
        height: 20px;
      }
      .n {
        display: inline-block;
        min-width: 2ch;
        font-size: 20px;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .n.bump {
        animation: m-count var(--m-pop) var(--spring);
      }
      /* UI-16a: ticking up, the number takes its family's colour */
      .n.tick {
        color: var(--tone);
      }
      .l {
        color: var(--text2);
        font-size: 15px;
      }
    `,
  ];
  constructor() {
    super();
    this.kind = 'money';
    this.value = 0;
    this.label = '';
    this._shown = null;
    this._raf = 0;
  }
  /** counts from what it showed to the new value (at once with reduced motion or the first time). UI-16a: the shared
   * count (logic/motion.js: 400-700 ms by the size of the change), the number in its family's colour while it ticks,
   * then a small pop and the count sound; pb-chip (ui-marks-kit.js) counts with this same code */
  willUpdate(ch) {
    if (!ch.has('value')) return;
    const from = this._shown,
      to = this.value;
    cancelAnimationFrame(this._raf);
    if (from == null || from === to || reduced() || !this.isConnected) {
      this._shown = to;
      this._ticking = false;
      return;
    }
    const t0 = performance.now(),
      ms = motionCountMs(from, to);
    this._ticking = true;
    const step = (/** @type {number} */ t) => {
      const k = Math.min(1, (t - t0) / ms);
      this._shown = motionCountAt(from, to, k);
      if (k < 1) this._raf = requestAnimationFrame(step);
      else {
        this._ticking = false;
        /* after the redraw, whose class binding would drop it */
        this.updateComplete.then(() => this.renderRoot.querySelector('.n')?.classList.add('bump'));
        pbSound('count');
      }
    };
    this._raf = requestAnimationFrame(step);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this._raf);
    this._shown = this.value;
  }
  render() {
    const k = /** @type {any} */ (RUN_CURRENCY_ICONS)[this.kind] || 'coin',
      name = this.label || this.kind;
    return html`<span class="chip" role="img" aria-label=${`${runNumber(this.value)} ${name}`}
      >${runIcon(k)}<span
        class="n ${this._ticking ? 'tick' : ''}"
        aria-hidden="true"
        @animationend=${e => e.target.classList.remove('bump')}
        >${runNumber(this._shown ?? this.value)}</span
      >${this.label ? html`<span class="l" aria-hidden="true">${this.label}</span>` : nothing}</span
    >`;
  }
};

/* ---------- the pick card: relic picks and the keep-one picker ---------- */
const PbPickCard = class extends LitElement {
  static properties = {
    heading: {},
    sub: {},
    facedown: { type: Boolean, reflect: true },
    /* UI-16a: dealt face down only for the show (the offer turns over by itself): a tap turns it and picks it */
    dealt: { type: Boolean },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    rarity: { reflect: true },
    kind: { reflect: true },
  };
  static styles = [
    runKitBase,
    runKitMotion,
    css`
      :host {
        display: block;
        min-width: 0;
        --w: 100%;
      }
      /* UI-14a: rarity (the owner's answer 9, the loot ladder as frame and pill): a 3 px frame in the tier's fill along
         the card's cut outline, the tier's pill at the top right, the name in the tier's text shade. The selected card
         keeps its gold edge line over the frame */
      .rar {
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        background: var(--rar);
        clip-path: polygon(
          evenodd,
          0 8px,
          8px 0,
          calc(100% - 8px) 0,
          100% 8px,
          100% calc(100% - 8px),
          calc(100% - 8px) 100%,
          8px 100%,
          0 calc(100% - 8px),
          0 8px,
          3px 12.24px,
          12.24px 3px,
          calc(100% - 12.24px) 3px,
          calc(100% - 3px) 12.24px,
          calc(100% - 3px) calc(100% - 12.24px),
          calc(100% - 12.24px) calc(100% - 3px),
          12.24px calc(100% - 3px),
          3px calc(100% - 12.24px),
          3px 12.24px
        );
      }
      .tier {
        position: absolute;
        top: var(--s2);
        right: var(--s3);
        z-index: 2;
      }
      :host([rarity]) h3 {
        color: var(--rar-t, inherit);
      }
      /* UI-14b: what kind of pickup (the colour code's "family colour + frame shape: the card's ribbon"): kind="..." (a
         UI_GLYPHS.kind id: perk, held, item, candy, evo, tutor, part, scrap) draws the sub line as a slanted ribbon
         in its family's tint with a bar of its fill and its glyph in its text shade; a neutral kind (item) stays
         plain grey */
      .sub.rib {
        display: inline-flex;
        align-items: center;
        gap: var(--s1);
        margin-top: var(--s1);
        padding: 1px var(--s2) 1px calc(var(--s2) + 3px);
        clip-path: var(--clip-chip);
        background:
          linear-gradient(90deg, var(--kind, var(--text2)) 0 3px, transparent 3px),
          color-mix(in srgb, var(--kind, var(--c-text)) 14%, transparent);
        color: var(--kind-t, var(--text2));
      }
      .sub .gl {
        flex: none;
        width: 12px;
        height: 12px;
        background-color: currentColor;
        -webkit-mask: var(--ico) center / contain no-repeat;
        mask: var(--ico) center / contain no-repeat;
      }
      button {
        position: relative;
        isolation: isolate;
        display: block;
        width: var(--w);
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: inherit;
        cursor: pointer;
        transform-style: preserve-3d;
      }
      button:disabled {
        cursor: default;
      }
      /* the face and the back share one grid cell, so the card is as tall as its face */
      .face,
      .back {
        grid-area: 1 / 1;
        position: relative;
        clip-path: var(--clip-card);
        backface-visibility: hidden;
      }
      .face {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: var(--s2);
        padding: var(--s3) var(--s3) var(--s4);
        background: linear-gradient(180deg, color-mix(in srgb, var(--g-solid) 92%, white), var(--g-solid));
      }
      .face::after {
        content: '';
        position: absolute;
        inset: 0;
        clip-path: var(--edge-card);
        background: var(--edge);
        pointer-events: none;
      }
      :host([selected]) .face::after {
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
      }
      .art {
        display: grid;
        place-items: center;
        min-height: 64px;
        clip-path: var(--clip-button);
        background: color-mix(in srgb, var(--c-text) 7%, transparent);
      }
      h3 {
        margin: 0;
        font-weight: 400;
        font-size: 19px;
        line-height: 1.1;
        overflow-wrap: anywhere;
      }
      .sub {
        margin: 2px 0 0;
        color: var(--text2);
        font: 13px / var(--lh-prose) var(--font-prose);
      }
      .text {
        font: 14px / var(--lh-prose) var(--font-prose);
        color: var(--text2);
      }
      .back {
        transform: rotateY(180deg);
        display: grid;
        place-items: center;
        background:
          repeating-linear-gradient(135deg, transparent 0 9px, color-mix(in srgb, var(--gold-a) 35%, transparent) 9px 11px),
          linear-gradient(180deg, color-mix(in srgb, var(--c-primary) 75%, black), color-mix(in srgb, var(--c-primary) 45%, black));
        color: var(--gold-a);
      }
      .back .ic {
        width: 40px;
        height: 40px;
      }
      .card {
        position: relative;
        display: grid;
        min-height: 168px;
        /* UI-16a: --m-k is 0 under Reduced: it turns at once and reveal() fades it */
        transition: transform calc(var(--m-slow) * var(--m-k, 1)) var(--spring);
        transform-style: preserve-3d;
      }
      :host([facedown]) .card {
        transform: rotateY(180deg);
      }
      :host([selected]) .card {
        transform: translateY(-6px);
      }
      .notch {
        position: absolute;
        left: 0;
        top: 24px;
        z-index: 3;
        width: 6px;
        height: 32px;
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
        clip-path: polygon(0 0, 100% 3px, 100% calc(100% - 3px), 0 100%);
        display: none;
      }
      :host([selected]) .notch {
        display: block;
      }
    `,
  ];
  constructor() {
    super();
    this.heading = '';
    this.sub = '';
    this.facedown = false;
    this.dealt = false;
    this.selected = false;
    this.disabled = false;
    this.rarity = '';
    this.kind = '';
  }
  /** turns it face up (the flip); with reduced motion it fades instead */
  reveal() {
    if (!this.facedown) return;
    if (reduced()) {
      this.facedown = false;
      this.renderRoot.querySelector('.card')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    } else this.facedown = false;
  }
  _pick() {
    if (this.disabled) return;
    if (this.facedown) {
      this.reveal();
      if (!this.dealt) return;
    }
    this.dispatchEvent(new CustomEvent('pb-pick', { bubbles: true, composed: true }));
  }
  /** the sub line, as the kind's ribbon when it has a kind (UI-14b) */
  _sub() {
    const K = this.kind ? glyphOf('kind', this.kind) : null;
    if (!K) return html`<p class="sub">${this.sub}</p>`;
    return html`<p class="sub rib" style=${K[1] ? `--kind:var(${sigVar(K[1])});--kind-t:var(${sigVar(K[1], true)})` : nothing}>
      <i class="gl" style=${`--ico:url('${runIconURL(K[0])}')`} aria-hidden="true"></i>${this.sub}
    </p>`;
  }
  render() {
    const t = rarityTier(this.rarity),
      rar = t ? `--rar:var(--sig-${t});--rar-t:var(--sig-${t}-text)` : '';
    return html`<button
      part="button"
      ?disabled=${this.disabled}
      aria-pressed=${String(this.selected)}
      aria-label=${this.facedown ? 'A face-down card: turn it over' : nothing}
      @click=${this._pick}
    >
      <span class="card">
        <span class="face" style=${rar || nothing} aria-hidden=${this.facedown ? 'true' : nothing}>
          ${
            t
              ? html`<span class="rar" aria-hidden="true"></span><pb-rarity class="tier" tier=${t}></pb-rarity>`
              : nothing
          }
          <span class="art"><slot name="art"></slot></span>
          <span>
            <h3>${this.heading}</h3>
            ${this.sub ? this._sub() : nothing}
            <span class="text"><slot></slot></span>
          </span>
        </span>
        <span class="back" aria-hidden="true">${runIcon('relic')}</span>
        <span class="notch" aria-hidden="true"></span>
      </span>
    </button>`;
  }
};

/* ---------- the payout: rows slam in one by one, the total counts up ---------- */
const PbPayout = class extends LitElement {
  static properties = {
    rows: { type: Array },
    total: { type: Number },
    totalLabel: { attribute: 'total-label' },
    kind: {},
    _n: { state: true },
    _t: { state: true },
  };
  static styles = [
    runKitBase,
    runKitMotion,
    css`
      :host {
        display: block;
      }
      ol {
        display: grid;
        gap: var(--s1);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        display: flex;
        align-items: baseline;
        gap: var(--s3);
        padding: var(--s2) var(--s3);
        clip-path: var(--clip-card);
        background: color-mix(in srgb, var(--c-text) 6%, transparent);
        font-size: 17px;
      }
      /* UI-16a: under Reduced (--m-k 0) a row is there at once */
      li.in {
        animation: m-slam calc(var(--m-slow) * var(--m-k, 1)) var(--spring) both;
      }
      li.wait {
        visibility: hidden;
      }
      .lab {
        flex: 1 1 auto;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .note {
        display: block;
        color: var(--text2);
        font: 13px / var(--lh-prose) var(--font-prose);
      }
      .v {
        flex: none;
        font-size: 20px;
        font-variant-numeric: tabular-nums;
      }
      /* UI-14b: a cost is the bad family's text shade (4.5:1 on surfaces, the colour code's check) */
      .v.neg {
        color: var(--sig-bad-text);
      }
      .tot {
        display: flex;
        align-items: center;
        gap: var(--s3);
        margin-top: var(--s3);
        padding: var(--s3) var(--s4);
        clip-path: var(--clip-action);
        background: var(--tot, linear-gradient(180deg, var(--gold-a), var(--gold-b)));
        color: var(--c-ink);
      }
      .tot .lab {
        font-size: 19px;
      }
      .tot .v {
        font-size: 28px;
      }
      .tot .v.bump {
        animation: m-count var(--m-base) var(--spring);
      }
      .tot .ic {
        width: 24px;
        height: 24px;
      }
    `,
  ];
  constructor() {
    super();
    this.rows = [];
    this.total = 0;
    this.totalLabel = 'Research';
    this.kind = 'research';
    this._n = Infinity;
    this._t = null;
    this._timers = [];
  }
  /** plays it from the first row (rows one --stagger-and-a-half apart, then the total's count-up) */
  play() {
    this._stop();
    const rows = this.rows || [];
    if (reduced()) {
      this._n = rows.length;
      this._t = this.total;
      this._tell('pb-payout-total', {});
      return;
    }
    this._n = 0;
    this._t = 0;
    const gap = Math.max(120, runMsVar(this, '--m-slow', 360) * 0.6);
    rows.forEach((_, i) =>
      this._timers.push(
        setTimeout(
          () => {
            this._n = i + 1;
            this._tell('pb-payout-row', { i });
          },
          gap * (i + 1)
        )
      )
    );
    this._timers.push(
      setTimeout(
        () => {
          const t0 = performance.now(),
            ms = Math.max(300, runMsVar(this, '--m-slow', 360) * 2.5),
            to = this.total;
          const step = (/** @type {number} */ t) => {
            const k = Math.min(1, (t - t0) / ms);
            this._t = to * (1 - (1 - k) ** 3);
            if (k < 1) this._raf = requestAnimationFrame(step);
            else {
              this.renderRoot.querySelector('.tot .v')?.classList.add('bump');
              this._tell('pb-payout-total', {});
            }
          };
          this._raf = requestAnimationFrame(step);
        },
        gap * (rows.length + 1)
      )
    );
  }
  /** shows the end at once (a tap to skip) */
  finish() {
    this._stop();
    this._n = (this.rows || []).length;
    this._t = this.total;
    this._tell('pb-payout-total', {});
  }
  /** SND-6: the page hears each row show (pb-payout-row, its index) and the total land (pb-payout-total) */
  _tell(/** @type {string} */ name, /** @type {object} */ detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }
  _stop() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
    cancelAnimationFrame(this._raf);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._stop();
  }
  render() {
    const rows = this.rows || [],
      n = Math.min(this._n, rows.length),
      t = this._t ?? this.total,
      k = /** @type {any} */ (RUN_CURRENCY_ICONS)[this.kind] || 'research',
      /* UI-14b: the total in its currency's family (Research sky, Moneys gold: logic/marks.js chipLook) */
      tone = chipLook(this.kind).sig;
    return html`<ol aria-label="Payout" @click=${() => this.finish()}>
        ${rows.map((r, i) => {
          const v = Number(r.value) || 0;
          return html`<li class=${i < n ? (this._n === Infinity ? '' : 'in') : 'wait'}>
            <span class="lab">${r.label}${r.note ? html`<span class="note">${r.note}</span>` : nothing}</span>
            <span class=${v < 0 ? 'v neg' : 'v'}>${v < 0 ? '−' : '+'}${runNumber(Math.abs(v))}</span>
          </li>`;
        })}
      </ol>
      <div
        class="tot"
        style=${tone ? `--tot:var(${sigVar(tone)})` : nothing}
        role="status"
        aria-label=${`${this.totalLabel}: ${runNumber(this.total)}`}
      >
        ${runIcon(k)}<span class="lab" aria-hidden="true">${this.totalLabel}</span
        ><span class="v" aria-hidden="true" @animationend=${e => e.target.classList.remove('bump')}
          >${runNumber(t)}</span
        >
      </div>`;
  }
};

/* ---------- SY-3: a stamp: a word in a rough border, slammed on at a slant ---------- */
/* The Bureau's paperwork (style-track.md: its stamp words are factions.json look.stamps; the page passes the word). Ink
   in the red family (--redink, which follows light and dark; --stamp-ink sets another), a word plus a shape (the double
   border), never colour alone. It slams on when it joins the page (play() again for another), and tells the page as it
   lands (pb-stamp-land: sound.js thunks); `still` shows it already stamped, with no slam and no thunk (a sheet drawn
   again). Reduced motion: it fades in. */
const PbStamp = class extends LitElement {
  static properties = {
    word: {},
    tilt: { type: Number },
    size: { reflect: true },
    still: { type: Boolean },
    _go: { state: true },
  };
  static styles = [
    runKitBase,
    runKitMotion,
    css`
      :host {
        display: inline-block;
        vertical-align: middle;
        line-height: 1;
        --stamp-fs: 22px;
      }
      :host([size='sm']) {
        --stamp-fs: 14px;
      }
      :host([size='lg']) {
        --stamp-fs: 34px;
      }
      .ink {
        position: relative;
        display: inline-block;
        padding: 0.3em 0.5em 0.22em;
        border: max(2px, 0.14em) solid currentColor;
        color: var(--stamp-ink, var(--redink));
        font: 700 var(--stamp-fs) / 1 var(--font-voice);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
        opacity: 0.92;
        transform: rotate(var(--tilt));
        /* the rough ink: three grids of pinholes at odd steps, so the gaps never line up */
        -webkit-mask:
          radial-gradient(circle at 30% 40%, transparent 0 0.6px, black 1.1px) 0 0 / 7px 5px,
          radial-gradient(circle at 70% 20%, transparent 0 0.5px, black 1px) 0 0 / 11px 9px,
          radial-gradient(circle at 50% 80%, transparent 0 0.7px, black 1.2px) 0 0 / 17px 13px;
        -webkit-mask-composite: source-in;
        mask-composite: intersect;
      }
      .ink::before {
        content: '';
        position: absolute;
        inset: max(2px, 0.12em);
        border: max(1px, 0.05em) solid currentColor;
        pointer-events: none;
      }
      .ink.a {
        animation: pb-stamp-a var(--m-base) cubic-bezier(0.5, 0, 0.9, 0.5) both;
      }
      .ink.b {
        animation: pb-stamp-b var(--m-base) cubic-bezier(0.5, 0, 0.9, 0.5) both;
      }
      :host-context([data-motion='reduced']) .ink.a,
      :host-context([data-motion='reduced']) .ink.b {
        animation: m-fade var(--m-fast) linear both;
      }
      @media (prefers-reduced-motion: reduce) {
        .ink.a,
        .ink.b {
          animation: m-fade var(--m-fast) linear both;
        }
      }
      /* two names for one slam, so play() can start it again */
      @keyframes pb-stamp-a {
        from {
          opacity: 0;
          transform: rotate(calc(var(--tilt) + 6deg)) scale(1.9);
        }
        55% {
          opacity: 0.92;
          transform: rotate(var(--tilt)) scale(0.94);
        }
        to {
          transform: rotate(var(--tilt)) scale(1);
        }
      }
      @keyframes pb-stamp-b {
        from {
          opacity: 0;
          transform: rotate(calc(var(--tilt) + 6deg)) scale(1.9);
        }
        55% {
          opacity: 0.92;
          transform: rotate(var(--tilt)) scale(0.94);
        }
        to {
          transform: rotate(var(--tilt)) scale(1);
        }
      }
    `,
  ];
  constructor() {
    super();
    this.word = '';
    this.tilt = -8;
    this.size = '';
    this.still = false;
    this._go = 0;
    this._timer = 0;
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.still) this.play();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._timer);
  }
  /** slams it on again; pb-stamp-land as it lands (at once under reduced motion) */
  play() {
    clearTimeout(this._timer);
    this.still = false;
    this._go++;
    const land = reduced() ? 0 : runMsVar(this, '--m-base', 240) * 0.55;
    this._timer = setTimeout(
      () =>
        this.dispatchEvent(
          new CustomEvent('pb-stamp-land', { detail: { word: this.word }, bubbles: true, composed: true })
        ),
      land
    );
  }
  willUpdate() {
    this.style.setProperty('--tilt', `${Number(this.tilt) || 0}deg`);
  }
  render() {
    const go = this.still || !this._go ? '' : this._go % 2 ? 'a' : 'b';
    return html`<span class="ink ${go}">${this.word}</span>`;
  }
};

/* ---------- the bottom bar: the minimap in the middle, two buttons on each side (UI-8) ---------- */
/* The set's first tab (Map) is the minimap tile; the rest go two to a side, the icon over the word. The tile's picture
   is the light-DOM child in slot "map" (the game's <canvas>, js/minimap.js); with none, the map icon. UI-8b: the tile
   is wide (uiTheme.json minimap tileW x tileH, 232 x 184) and stands out of the bar's frame by --rise; the bar is a
   plain cut outline from --rise down, so the world shows on both sides of the tile's top. A narrow bar shrinks the
   whole tile, keeping its shape, so each side keeps 60 px. `compact` (while walking): a square tile (tileCompact),
   icon-only buttons side by side. */
const navStep = (/** @type {number} */ i) => {
  /* the outline inset by i px (0: the outer line; 1: the edge line's inside); 45° corners move by i·tan(22.5°) */
  const k = i * 0.4142,
    c = 'var(--cut-md)',
    R = 'var(--rise)';
  return [
    `${i}px calc(${R} + ${c} + ${k}px)`,
    `calc(${c} + ${k}px) calc(${R} + ${i}px)`,
    `calc(100% - ${c} - ${k}px) calc(${R} + ${i}px)`,
    `calc(100% - ${i}px) calc(${R} + ${c} + ${k}px)`,
    `calc(100% - ${i}px) calc(100% - ${i}px)`,
    `${i}px calc(100% - ${i}px)`,
  ].join(', ');
};
const PbNavBar = class extends LitElement {
  static properties = {
    set: { reflect: true },
    value: { reflect: true },
    badges: {},
    hide: {},
    compact: { type: Boolean, reflect: true },
  };
  static styles = [
    runKitBase,
    css`
      /* the host is the container: its width (cqw) sizes the tile; a side keeps 60 px plus 8 px of margins */
      :host {
        --tile-w: min(var(--minimap-tile-w, 232px), 100cqw - 136px);
        --tile-h: min(var(--minimap-tile-h, 184px), (100cqw - 136px) * var(--minimap-tile-aspect, 0.7931));
        --bar-h: 128px;
        --rise: max(0px, var(--tile-h) + var(--s2) - var(--bar-h));
        display: block;
        position: relative;
        isolation: isolate;
        container-type: inline-size;
      }
      /* walking: a square; a side keeps two 46 px buttons */
      :host([compact]) {
        --tile-w: min(var(--minimap-tile-compact, 112px), 100cqw - 208px);
        --tile-h: var(--tile-w);
        --bar-h: 76px;
        --rise: max(0px, var(--tile-h) + 4px - var(--bar-h));
      }
      nav {
        position: relative;
        height: calc(var(--rise) + var(--bar-h) + env(safe-area-inset-bottom, 0px));
        transition: height calc(var(--m-base) * var(--m-k, 1)) var(--ease-out);
      }
      .glass,
      .edge {
        position: absolute;
        inset: 0;
        z-index: var(--z-below);
        pointer-events: none;
      }
      .glass {
        clip-path: polygon(${unsafeCSS(navStep(0))});
        background: color-mix(in srgb, var(--c-surface) calc(var(--glass, 0.7) * 100%), transparent);
        -webkit-backdrop-filter: blur(calc(var(--blur, 16px) * 0.75)) saturate(var(--saturate, 1.5));
        backdrop-filter: blur(calc(var(--blur, 16px) * 0.75)) saturate(var(--saturate, 1.5));
      }
      .edge {
        clip-path: polygon(evenodd, ${unsafeCSS(navStep(0))}, ${unsafeCSS(navStep(1))});
        background: var(--edge);
      }
      .side {
        --apart: var(--s2); /* its margin and the gap to the tile: 60 px columns at the narrowest */
        position: absolute;
        top: calc(var(--rise) + var(--s1));
        width: calc((100% - var(--tile-w)) / 2 - var(--apart));
        display: flex;
        flex-direction: column;
        gap: var(--s1);
      }
      .side.l {
        left: var(--s1);
      }
      .side.r {
        right: var(--s1);
      }
      :host([compact]) .side {
        flex-direction: row;
      }
      :host([compact]) .side.r {
        justify-content: flex-end;
      }
      button {
        position: relative;
        isolation: isolate;
        border: 0;
        background: none;
        cursor: pointer;
        color: var(--text2);
        font: 15px/1 var(--font-voice);
      }
      /* standing: the icon over the word */
      .tab {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        min-width: 0;
        min-height: 52px;
        padding: 0 var(--s1);
      }
      .tab .ic {
        width: 24px;
        height: 24px;
      }
      .tab span {
        max-width: 100%;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      :host([compact]) .tab {
        justify-content: center;
        width: 46px;
        min-height: 46px;
        padding: 0;
      }
      :host([compact]) .tab span {
        display: none;
      }
      .tab::before {
        content: none; /* only the current tab has the gold bar */
        position: absolute;
        inset: 3px 4px;
        z-index: var(--z-below);
        transform: skewX(calc(var(--slant) * -1));
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
      }
      .tab[aria-current='page'] {
        color: var(--goldink, #3a2408);
      }
      .tab[aria-current='page']::before {
        content: '';
      }
      .badge {
        position: absolute;
        top: 2px;
        left: calc(50% + 4px);
        display: grid;
        place-items: center;
        min-width: 20px;
        height: 20px;
        padding: 0 4px;
        clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        background: var(--c-danger);
        color: var(--c-surface);
        font-size: 12px;
      }
      :host([compact]) .badge {
        left: auto;
        right: 0;
        top: 0;
      }
      /* the minimap tile: the card family's outline (four small cuts), its edge gold and a gold notch when open */
      .map {
        position: absolute;
        top: var(--s1);
        left: calc(50% - var(--tile-w) / 2);
        width: var(--tile-w);
        height: var(--tile-h);
        padding: 0;
        /* UI-16a: at once under Reduced (--m-k 0) */
        transition:
          width calc(var(--m-base) * var(--m-k, 1)) var(--ease-out),
          height calc(var(--m-base) * var(--m-k, 1)) var(--ease-out),
          left calc(var(--m-base) * var(--m-k, 1)) var(--ease-out),
          top calc(var(--m-base) * var(--m-k, 1)) var(--ease-out);
      }
      :host([compact]) .map {
        top: 2px;
      }
      .map .face {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        clip-path: var(--clip-card);
        background: color-mix(in srgb, var(--c-primary) 30%, var(--c-surface));
      }
      .map .face ::slotted(*) {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .map .face .ic {
        width: 32px;
        height: 32px;
      }
      .map .edge {
        z-index: 1;
        clip-path: var(--edge-card);
      }
      .map[aria-current='page'] .edge {
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
      }
      .map .notch {
        position: absolute;
        left: 0;
        top: 50%;
        z-index: 2;
        width: 6px;
        height: min(40%, 32px);
        transform: translateY(-50%);
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
        clip-path: polygon(0 0, 100% 3px, 100% calc(100% - 3px), 0 100%);
        display: none;
      }
      .map[aria-current='page'] .notch {
        display: block;
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      button:focus-visible {
        outline: none;
        text-decoration: underline 2px;
        text-underline-offset: 3px;
      }
      .map:focus-visible .edge {
        background: var(--text);
      }
    `,
  ];
  constructor() {
    super();
    this.set = 'hub';
    this.value = 'map';
    this.badges = '';
    this.hide = '';
    this.compact = false;
  }
  /* UI-16a: the gold bar slides from the tab that was open to the new one (where the old one stood, before the redraw) */
  willUpdate(ch) {
    this._from =
      ch.has('value') && ch.get('value') != null ? this.tabEl(ch.get('value'))?.getBoundingClientRect() : null;
  }
  updated() {
    if (this._from) pbSlideBar(this._from, this.tabEl(this.value)?.getBoundingClientRect() || null);
    this._from = null;
  }
  /** a tab's button (the fly-to's target for a gain: Bag, Perks) @param {string} id */
  tabEl(id) {
    return this.renderRoot.querySelector(`[data-t="${CSS.escape(String(id))}"]`);
  }
  /* UI-5: hide lists tabs to leave out (ids, comma-separated): a set's tab whose screen isn't built yet */
  get tabs() {
    const off = String(this.hide || '').split(',');
    return /** @type {any} */ (RUN_NAV_SETS[this.set] || RUN_NAV_SETS.hub).filter(t => !off.includes(t.id));
  }
  get badgeOf() {
    return Object.fromEntries(runList(this.badges).map(b => [b.id, Number(b.label) || 0]));
  }
  /* UI-5: the open tab tapped again sends pb-reselect (the game goes back to the world) */
  pick(id) {
    if (id === this.value) {
      this.dispatchEvent(new CustomEvent('pb-reselect', { detail: { value: id }, bubbles: true, composed: true }));
      return;
    }
    this.value = id;
    this.dispatchEvent(new CustomEvent('pb-change', { detail: { value: id }, bubbles: true, composed: true }));
  }
  render() {
    const b = this.badgeOf,
      say = (/** @type {string} */ s) => (typeof i18nText === 'function' ? i18nText(s) : s),
      all = this.tabs,
      map = all.find(t => t.id === 'map'),
      rest = all.filter(t => t !== map),
      half = Math.ceil(rest.length / 2);
    const tab = t =>
      html`<button
        class="tab"
        part="tab"
        data-t=${t.id}
        aria-label=${say(t.label)}
        aria-current=${t.id === this.value ? 'page' : nothing}
        @click=${() => this.pick(t.id)}
      >
        ${runIcon(t.icon)}<span aria-hidden="true">${say(t.label)}</span>${
          b[t.id] > 0
            ? html`<b class="badge" aria-label=${`${b[t.id]} new`}>${b[t.id] > 9 ? '9+' : b[t.id]}</b>`
            : nothing
        }
      </button>`;
    return html`<nav aria-label=${this.set === 'run' ? 'Run' : 'Hub'}>
      <i class="glass" aria-hidden="true"></i><i class="edge" aria-hidden="true"></i>
      <div class="side l">${rest.slice(0, half).map(tab)}</div>
      ${
        map
          ? html`<button
            class="map"
            part="map"
            data-t="map"
            aria-current=${this.value === 'map' ? 'page' : nothing}
            @click=${() => this.pick('map')}
          >
            <span class="face"><slot name="map">${runIcon(map.icon)}</slot></span>
            <i class="edge" aria-hidden="true"></i><i class="notch" aria-hidden="true"></i>
            <span class="sr">${say(map.label)}</span>
          </button>`
          : nothing
      }
      <div class="side r">${rest.slice(half).map(tab)}</div>
    </nav>`;
  }
};

/* ---------- HB-2: the run's loading screen ---------- */
/* The whole screen while a run's world comes in: the region's name, a tip, the bar and the stages (waiting, working,
   ready, late). The picture is a slot (`view`): empty, the theme's own backdrop; HB-8 puts the carriage there. With
   `contained` it fills its box instead of the screen (the UI gallery). Cutscenes track (part C): `tips` turn over every
   few seconds (one at a time, faded), a second slot (`card`) holds the region's card under the name, the stages fold
   into one line (the one under way, how many are ready, a diamond each), and `night` gives it the portal tunnel's dark
   colours (the carriage's screens), so it never reads as an empty page. */
const PbLoading = class extends LitElement {
  static properties = {
    heading: {},
    sub: {},
    tip: {},
    tips: { type: Array },
    value: { type: Number },
    stages: { type: Array },
    contained: { type: Boolean, reflect: true },
    night: { type: Boolean, reflect: true },
    _tipAt: { state: true },
  };
  static styles = [
    runKitBase,
    runKitMotion,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: block;
        background: var(--g-solid);
        color: var(--text);
      }
      :host([contained]) {
        position: relative;
        inset: auto;
        z-index: auto;
        min-height: 420px;
      }
      :host([night]) {
        --g-solid: var(--night-bg);
        --text: var(--night-text);
        --text2: var(--night-text2);
        color-scheme: dark;
      }
      /* the picture (the carriage) above the text, not under it */
      :host([night]) .view {
        bottom: 52%;
      }
      .view {
        position: absolute;
        inset: 0;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--gold-b) 26%, transparent), transparent 62%),
          var(--g-solid);
      }
      .box {
        position: absolute;
        inset: auto 0 0 0;
        display: grid;
        gap: var(--s2);
        padding: var(--s4) calc(var(--s3) + 16px) calc(var(--s4) + env(safe-area-inset-bottom, 0px));
        animation: m-fade var(--m-slow) var(--ease-out, ease-out);
      }
      small {
        font-size: 15px;
        color: var(--text2);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h2 {
        margin: 0;
        font: 400 30px / 1.1 var(--font-voice);
      }
      .tip {
        margin: 0;
        max-width: 34em;
        font: 15px / var(--lh-prose) var(--font-prose);
        color: var(--text2);
      }
      .now {
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--s2);
        font-size: 15px;
        color: var(--text2);
      }
      .now b {
        font-weight: 600;
        color: var(--text);
      }
      ol {
        margin: 0;
        padding: 0;
        list-style: none;
        display: inline-flex;
        gap: var(--s1);
      }
      li {
        display: inline-flex;
        align-items: center;
      }
      li::before {
        content: '';
        width: 9px;
        height: 9px;
        clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        background: color-mix(in srgb, var(--text) 25%, transparent);
      }
      li[data-s='working']::before {
        background: var(--gold-b);
        animation: pb-load-pulse 0.9s ease-in-out infinite alternate;
      }
      @keyframes pb-load-pulse {
        to {
          opacity: 0.35;
        }
      }
      .tip {
        min-height: 3.2em;
      }
      .tip.turn {
        animation: m-fade var(--m-slow) var(--ease-out, ease-out);
      }
      @media (prefers-reduced-motion: reduce) {
        li[data-s='working']::before,
        .tip.turn {
          animation: none;
        }
      }
      li[data-s='ready']::before {
        background: var(--c-primary);
      }
      li[data-s='late']::before {
        background: var(--c-danger);
      }
    `,
  ];
  constructor() {
    super();
    this.heading = '';
    this.sub = '';
    this.tip = '';
    this.value = 0;
    /** @type {{ id: string, label: string, state?: string }[]} */
    this.stages = [];
    this.contained = false;
    this.night = false;
    /** @type {string[]} */
    this.tips = [];
    this._tipAt = 0;
    /** @type {any} */
    this._turn = 0;
  }
  connectedCallback() {
    super.connectedCallback();
    /* a tip a few seconds, while there is more than one */
    this._turn = setInterval(() => {
      if (this.tips.length > 1) this._tipAt = (this._tipAt + 1) % this.tips.length;
    }, 4200);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._turn);
  }
  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    /* a new tip fades in */
    const el = changed.has('_tipAt') && changed.get('_tipAt') !== undefined && this.renderRoot.querySelector('.tip');
    if (!el) return;
    el.classList.remove('turn');
    void (/** @type {HTMLElement} */ (el).offsetWidth);
    el.classList.add('turn');
  }
  render() {
    const p = Math.round(Math.max(0, Math.min(1, this.value || 0)) * 100),
      tip = this.tips.length ? this.tips[this._tipAt % this.tips.length] : this.tip,
      ready = this.stages.filter(s => s.state === 'ready').length,
      now = this.stages.find(s => s.state === 'working') || this.stages.find(s => s.state !== 'ready');
    return html`<div class="view" part="view"><slot name="view"></slot></div>
      <div class="box" role="status" aria-live="polite" aria-label=${`${this.heading || 'Loading'}, ${p}%`}>
        ${this.sub ? html`<small>${this.sub}</small>` : nothing}
        ${this.heading ? html`<h2>${this.heading}</h2>` : nothing}
        <slot name="card"></slot>
        <pb-stat-bar kind="stat" .value=${p} .max=${100} label="Loading"></pb-stat-bar>
        ${
          this.stages.length
            ? html`<div class="now">
              <ol>
                ${this.stages.map(s => html`<li data-s=${s.state || 'waiting'} aria-label=${s.label}></li>`)}
              </ol>
              <span><b>${now ? now.label : 'Ready'}</b> · ${ready} of ${this.stages.length}</span>
            </div>`
            : nothing
        }
        ${tip ? html`<p class="tip">${tip}</p>` : nothing}
      </div>`;
  }
};

for (const [tag, cls] of /** @type {const} */ ([
  ['pb-day-chip', PbDayChip],
  ['pb-forecast', PbForecast],
  ['pb-node', PbNode],
  ['pb-coin', PbCoin],
  ['pb-pick-card', PbPickCard],
  ['pb-payout', PbPayout],
  ['pb-nav-bar', PbNavBar],
  ['pb-loading', PbLoading],
  ['pb-stamp', PbStamp],
]))
  if (!customElements.get(tag)) customElements.define(tag, cls);
