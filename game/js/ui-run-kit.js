'use strict';
/* ================= UI KIT: THE RUN PARTS (UI track UI-4) =================
   The parts the run's screens build from (docs/phases/ui-track.md, UI-4), so RL-7 and RL-8 need no CSS of their own.
   Lit web components like js/ui-kit.js, on its tokens only; nothing in the game uses them yet (the UI gallery shows
   every state). Values come in as attributes or properties: no game data is read here, so the currency and node
   names stay the caller's (currencies.json and nodeTypes.json come later).
     <pb-day-chip day="3" deadline="7">               "Day 3 · deadline day 7"; gold on the last day, red past it
     <pb-forecast items="clear:Clear,rain:Rain" from="3" value="3">   the weather by day, today marked
     <pb-node type="town" state="seen" weather="rain" label="Marrow Town">   a run map marker (js/logic/run-marks.js)
     <pb-coin kind="money|capital|scrap|seals" value="340" label="Moneys">   a currency chip that counts to a new value
     <pb-pick-card heading="..." facedown selected>   the relic pick and keep-one card; turning it face up flips it
     <pb-payout rows='[{"label":"Moneys left","value":170}]' total="420" total-label="Capital">   rows slam in, the
                                                       total counts up (play() runs it again); pb-payout-row
                                                       as each row shows, pb-payout-total as the total lands
     <pb-nav-bar set="run|hub" value="map" badges="relics:2">   the bottom bar (pb-change)
   The motions here repeat css/motion.css's reward motions (m-slam, m-flip), as a component's styles can't see the
   page's; with reduced motion each one is a fade and numbers jump to their end. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { i18nText } from './hooks.js';
import { runMarkLook } from './logic/run-marks.js';
import { LitElement, css, html, nothing, reduced } from './ui-kit.js';
expose({
  PbCoin: [() => PbCoin],
  PbDayChip: [() => PbDayChip],
  PbForecast: [() => PbForecast],
  PbNavBar: [() => PbNavBar],
  PbNode: [() => PbNode],
  PbPayout: [() => PbPayout],
  PbPickCard: [() => PbPickCard],
  RUN_CURRENCY_ICONS: [() => RUN_CURRENCY_ICONS],
  RUN_NAV_SETS: [() => RUN_NAV_SETS],
  RUN_WEATHER_ICONS: [() => RUN_WEATHER_ICONS],
  runIcon: [() => runIcon],
  runIconURL: [() => runIconURL],
  runKitBase: [() => runKitBase],
  runKitMotion: [() => runKitMotion],
  runList: [() => runList],
  runMsVar: [() => runMsVar],
  runNumber: [() => runNumber],
  runSvg: [() => runSvg],
});
/* to-module: end */
/* Lit's html, css, LitElement and nothing, and reduced(), come from js/ui-kit.js (one name each on the page) */
const runSvg = /** @type {any} */ (self).PB_LIT.svg;

/* a UI icon (game/art/ui/<key>.svg) as a mask tinted by the text colour, found as art.js finds it (the bundled
   build inlines them in NW_ART; a page outside game/ sets NW_ARTDIR) */
const runIconURL = (/** @type {string} */ k) => {
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
const runNumber = (/** @type {number} */ n) => Math.round(n).toLocaleString('en-US');

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
/* the four currencies' icons (names are placeholders until currencies.json, roguelite-track.md 8.5) */
const RUN_CURRENCY_ICONS = { money: 'coin', capital: 'capital', scrap: 'scrap', seals: 'seal' };
/* the bottom bar's two sets (owner's decision: one bar whose tabs change) */
const RUN_NAV_SETS = {
  run: [
    { id: 'map', label: 'Map', icon: 'map' },
    { id: 'team', label: 'Team', icon: 'team' },
    { id: 'bag', label: 'Bag', icon: 'bag' },
    { id: 'relics', label: 'Loopholes', icon: 'relic' },
  ],
  hub: [
    { id: 'map', label: 'Map', icon: 'map' },
    { id: 'team', label: 'Team', icon: 'team' },
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
    background: currentColor;
    -webkit-mask: var(--ico) center / contain no-repeat;
    mask: var(--ico) center / contain no-repeat;
  }
`;
/* the reward motions (css/motion.css m-slam, m-flip), repeated for the shadow styles */
const runKitMotion = css`
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

/* ---------- the day and deadline chip ---------- */
const PbDayChip = class extends LitElement {
  static properties = { day: { type: Number }, deadline: { type: Number } };
  static styles = [
    runKitBase,
    css`
      :host {
        display: inline-block;
        --tone: var(--c-surface);
        --ink: var(--text);
      }
      :host([tone='last']) {
        --tone: var(--gold-b);
        --ink: var(--goldink, #3a2408);
      }
      :host([tone='over']) {
        --tone: var(--c-danger);
        --ink: var(--c-surface); /* reads on danger in both themes (white fails on the dark side) */
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
      .sep {
        opacity: 0.6;
      }
    `,
  ];
  constructor() {
    super();
    this.day = 1;
    this.deadline = 0;
  }
  /** calm, last (the deadline is today) or over (past it) */
  get tone() {
    return !this.deadline ? 'calm' : this.day > this.deadline ? 'over' : this.day === this.deadline ? 'last' : 'calm';
  }
  updated() {
    this.setAttribute('tone', this.tone);
  }
  render() {
    const t = this.tone,
      late = this.day - this.deadline,
      said = !this.deadline
        ? `Day ${this.day}`
        : t === 'over'
          ? `Day ${this.day}, ${late} ${late === 1 ? 'day' : 'days'} past the deadline`
          : t === 'last'
            ? `Day ${this.day}, the deadline is today`
            : `Day ${this.day}, deadline day ${this.deadline}`;
    return html`<span class="chip" role="status" aria-label=${said}
      >${runIcon('clock')}<span>Day <b>${this.day}</b></span>${
        this.deadline
          ? html`<span class="sep" aria-hidden="true">·</span><span>deadline day ${this.deadline}</span>`
          : nothing
      }</span
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
const PbNode = class extends LitElement {
  static properties = { type: { reflect: true }, state: { reflect: true }, weather: {}, label: {} };
  static styles = [
    runKitBase,
    css`
      :host {
        --size: 44px;
        display: inline-grid;
        position: relative;
        width: var(--size);
        height: var(--size);
        --fill: var(--c-surface);
        --line: var(--c-text);
        --ink: var(--c-text);
      }
      :host([data-tone='primary']) {
        --fill: var(--c-primary);
        --line: color-mix(in srgb, var(--c-primary) 55%, black);
        --ink: var(--c-surface);
      }
      :host([data-tone='danger']) {
        --fill: var(--c-danger);
        --line: color-mix(in srgb, var(--c-danger) 55%, black);
        --ink: var(--c-surface);
      }
      :host([data-tone='gold']) {
        --fill: var(--gold-b);
        --line: color-mix(in srgb, var(--gold-b) 50%, black);
        --ink: var(--goldink, #3a2408);
      }
      :host([data-tone='muted']) {
        --fill: color-mix(in srgb, var(--c-text) 22%, var(--c-surface));
        --line: color-mix(in srgb, var(--c-text) 45%, transparent);
        --ink: var(--c-text2);
      }
      svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      polygon {
        fill: var(--fill);
        stroke: var(--line);
        stroke-width: 1.5px;
        stroke-linejoin: miter;
        vector-effect: non-scaling-stroke;
      }
      :host([state='current']) svg {
        filter: drop-shadow(0 0 6px color-mix(in srgb, var(--gold-a) 80%, transparent));
      }
      :host([state='visited']) svg,
      :host([state='locked']) svg {
        opacity: 0.6;
      }
      .g {
        place-self: center;
        position: relative;
        color: var(--ink);
        font-size: calc(var(--size) * 0.45);
        line-height: 1;
      }
      .g.ic {
        width: calc(var(--size) * 0.4);
        height: calc(var(--size) * 0.4);
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
  }
  get look() {
    return runMarkLook(this.type, this.state);
  }
  updated() {
    this.dataset.tone = this.look.tone;
  }
  render() {
    const L = this.look,
      pts = L.points.map(([x, y]) => `${x},${y}`).join(' '),
      wx = this.weather && this.state !== 'hidden' && /** @type {any} */ (RUN_WEATHER_ICONS)[this.weather],
      said =
        this.state === 'hidden'
          ? 'Not yet seen'
          : [this.label || this.type, this.state !== 'seen' ? this.state : '', this.weather].filter(Boolean).join(', ');
    return html`<span role="img" aria-label=${said} style="display:contents"
      ><svg viewBox="0 0 100 100" aria-hidden="true">${runSvg`<polygon points=${pts}></polygon>`}</svg
      >${
        L.glyph === '?'
          ? html`<span class="g" aria-hidden="true">?</span>`
          : L.glyph
            ? runIcon(L.glyph, 'g ic')
            : nothing
      }${wx ? html`<span class="wx" aria-hidden="true">${runIcon(wx)}</span>` : nothing}</span
    >`;
  }
};

/* ---------- a currency chip ---------- */
const PbCoin = class extends LitElement {
  static properties = { kind: { reflect: true }, value: { type: Number }, label: {}, _shown: { state: true } };
  static styles = [
    runKitBase,
    runKitMotion,
    css`
      :host {
        display: inline-block;
        --tone: var(--gold-b);
      }
      :host([kind='capital']) {
        --tone: var(--c-primary);
      }
      :host([kind='scrap']) {
        --tone: color-mix(in srgb, var(--c-text) 55%, var(--c-surface));
      }
      :host([kind='seals']) {
        --tone: var(--c-danger);
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
        animation: m-count var(--m-base) var(--spring);
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
  /** counts from what it showed to the new value over --m-slow (at once with reduced motion or the first time) */
  willUpdate(ch) {
    if (!ch.has('value')) return;
    const from = this._shown,
      to = this.value;
    cancelAnimationFrame(this._raf);
    if (from == null || from === to || reduced() || !this.isConnected) {
      this._shown = to;
      return;
    }
    const t0 = performance.now(),
      ms = Math.max(200, runMsVar(this, '--m-slow', 360) * 2);
    const step = (/** @type {number} */ t) => {
      const k = Math.min(1, (t - t0) / ms);
      this._shown = from + (to - from) * (1 - (1 - k) ** 3);
      if (k < 1) this._raf = requestAnimationFrame(step);
      else this.renderRoot.querySelector('.n')?.classList.add('bump');
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
      >${runIcon(k)}<span class="n" aria-hidden="true" @animationend=${e => e.target.classList.remove('bump')}
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
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
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
        transition: transform var(--m-slow) var(--spring);
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
      :host-context([data-motion='reduced']) .card {
        transition: opacity var(--m-fast) linear;
      }
      @media (prefers-reduced-motion: reduce) {
        .card {
          transition: opacity var(--m-fast) linear;
        }
      }
    `,
  ];
  constructor() {
    super();
    this.heading = '';
    this.sub = '';
    this.facedown = false;
    this.selected = false;
    this.disabled = false;
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
    if (this.facedown) return this.reveal();
    this.dispatchEvent(new CustomEvent('pb-pick', { bubbles: true, composed: true }));
  }
  render() {
    return html`<button
      part="button"
      ?disabled=${this.disabled}
      aria-pressed=${String(this.selected)}
      aria-label=${this.facedown ? 'A face-down card: turn it over' : nothing}
      @click=${this._pick}
    >
      <span class="card">
        <span class="face" aria-hidden=${this.facedown ? 'true' : nothing}>
          <span class="art"><slot name="art"></slot></span>
          <span>
            <h3>${this.heading}</h3>
            ${this.sub ? html`<p class="sub">${this.sub}</p>` : nothing}
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
      li.in {
        animation: m-slam var(--m-slow) var(--spring) both;
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
      .v.neg {
        color: color-mix(in srgb, var(--c-danger) 70%, var(--c-text)); /* danger alone reads 3.7:1 here */
      }
      .tot {
        display: flex;
        align-items: center;
        gap: var(--s3);
        margin-top: var(--s3);
        padding: var(--s3) var(--s4);
        clip-path: var(--clip-action);
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
        color: var(--goldink, #3a2408);
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
      :host-context([data-motion='reduced']) li.in {
        animation: m-fade var(--m-fast) linear both;
      }
      @media (prefers-reduced-motion: reduce) {
        li.in {
          animation: m-fade var(--m-fast) linear both;
        }
      }
    `,
  ];
  constructor() {
    super();
    this.rows = [];
    this.total = 0;
    this.totalLabel = 'Capital';
    this.kind = 'capital';
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
      k = /** @type {any} */ (RUN_CURRENCY_ICONS)[this.kind] || 'capital';
    return html`<ol aria-label="Payout" @click=${() => this.finish()}>
        ${rows.map((r, i) => {
          const v = Number(r.value) || 0;
          return html`<li class=${i < n ? (this._n === Infinity ? '' : 'in') : 'wait'}>
            <span class="lab">${r.label}${r.note ? html`<span class="note">${r.note}</span>` : nothing}</span>
            <span class=${v < 0 ? 'v neg' : 'v'}>${v < 0 ? '−' : '+'}${runNumber(Math.abs(v))}</span>
          </li>`;
        })}
      </ol>
      <div class="tot" role="status" aria-label=${`${this.totalLabel}: ${runNumber(this.total)}`}>
        ${runIcon(k)}<span class="lab" aria-hidden="true">${this.totalLabel}</span
        ><span class="v" aria-hidden="true" @animationend=${e => e.target.classList.remove('bump')}
          >${runNumber(t)}</span
        >
      </div>`;
  }
};

/* ---------- the bottom bar: one bar whose tabs change (run: Map, Team, Bag, Relics; hub: Map, Team, Bag, Lab) ---------- */
const PbNavBar = class extends LitElement {
  static properties = { set: { reflect: true }, value: { reflect: true }, badges: {}, hide: {} };
  static styles = [
    runKitBase,
    css`
      :host {
        display: block;
        position: relative;
        isolation: isolate;
      }
      nav {
        position: relative;
        display: flex;
        gap: 2px;
        padding: var(--s1) var(--s2) calc(var(--s1) + env(safe-area-inset-bottom, 0px));
      }
      nav::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: var(--z-below);
        clip-path: var(--clip-tab);
        background: color-mix(in srgb, var(--c-surface) calc(var(--glass, 0.7) * 100%), transparent);
        -webkit-backdrop-filter: blur(calc(var(--blur, 16px) * 0.75)) saturate(var(--saturate, 1.5));
        backdrop-filter: blur(calc(var(--blur, 16px) * 0.75)) saturate(var(--saturate, 1.5));
      }
      nav::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: var(--z-below);
        clip-path: var(--edge-tab);
        background: var(--edge);
        pointer-events: none;
      }
      button {
        position: relative;
        isolation: isolate;
        display: grid;
        justify-items: center;
        align-content: center;
        gap: 2px;
        flex: 1 1 0;
        min-width: 0;
        min-height: 52px;
        padding: var(--s1) var(--s1);
        border: 0;
        background: none;
        color: var(--text2);
        font: 15px/1 var(--font-voice);
        cursor: pointer;
      }
      button .ic {
        width: 22px;
        height: 22px;
      }
      button span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      button::before {
        content: none; /* only the current tab has the gold bar (so nothing reads it behind the others) */
        position: absolute;
        inset: 3px 4px;
        z-index: var(--z-below);
        transform: skewX(calc(var(--slant) * -1));
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
      }
      button[aria-current='page'] {
        color: var(--goldink, #3a2408);
      }
      button[aria-current='page']::before {
        content: '';
      }
      .badge {
        position: absolute;
        top: 2px;
        left: calc(50% + 8px);
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
      button:focus-visible {
        outline: none;
        text-decoration: underline 2px;
        text-underline-offset: 3px;
      }
    `,
  ];
  constructor() {
    super();
    this.set = 'hub';
    this.value = 'map';
    this.badges = '';
    this.hide = '';
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
    const b = this.badgeOf;
    return html`<nav aria-label=${this.set === 'run' ? 'Run' : 'Hub'}>
      ${this.tabs.map(
        t =>
          html`<button
            part="tab"
            data-t=${t.id}
            aria-current=${t.id === this.value ? 'page' : nothing}
            @click=${() => this.pick(t.id)}
          >
            ${runIcon(t.icon)}<span>${typeof i18nText === 'function' ? i18nText(t.label) : t.label}</span>${
              b[t.id] > 0
                ? html`<b class="badge" aria-label=${`${b[t.id]} new`}>${b[t.id] > 9 ? '9+' : b[t.id]}</b>`
                : nothing
            }
          </button>`
      )}
    </nav>`;
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
]))
  if (!customElements.get(tag)) customElements.define(tag, cls);
