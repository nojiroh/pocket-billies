'use strict';
/* ================= UI KIT (phase 06) =================
   The shared components every screen builds from (docs/phases/06-plan.md "Structure"), as Lit web components:
     <pb-panel depth="raised|float|flat">   a glass panel that breathes (padding --pad-panel)
     <pb-pill tone="#hex or a var">         a small label (types, counts, badges)
     <pb-button kind="gold|dark|quiet" wide disabled>   a button that presses in; put data-a on the pb-button
     <pb-sheet open heading="...">          a sheet that slides up; drag it down or press Escape to close (pb-close)
     <pb-toast>                             the message under the top bar; swipe it up to dismiss (pb-dismiss)
   UI-2 (docs/phases/ui-track.md, Semigloss Angular) cut their corners and added:
     <pb-card selected depth="flat">        a solid card inside a panel; a gold notch when selected
     <pb-tabs items="a:A,b:B" value="a">    a row of trapezoid tabs (pb-change)
     <pb-stat-bar value max kind="hp|xp|stat" segments>   an angular, segmented bar
     <pb-field label value hint error>      a labelled text field
   and two helpers: pbFloat (a number rising from where something happened) and pbInboxDot (the dot on the portrait).
   Lit comes from game/vendor/lit.js (tools/vendor-lit.mjs), a classic script that sets self.PB_LIT. Text in templates is escaped by Lit; never pass markup as
   a string. Colours, sizes and timings come from css/tokens.css; the shadow styles below only read its variables.
   The motions here repeat css/motion.css's keyframes, because a component's own styles can't see the page's. */
/* Lit, from the classic script game/vendor/lit.js (tools/vendor-lit.mjs), loaded before the modules */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
/* eslint-disable no-func-assign */
expose({
  GLYPH_URLS: [() => GLYPH_URLS],
  LitElement: [() => LitElement],
  PbButton: [() => PbButton],
  PbCard: [() => PbCard],
  PbField: [() => PbField],
  PbPanel: [() => PbPanel],
  PbPill: [() => PbPill],
  PbSheet: [() => PbSheet],
  PbStatBar: [() => PbStatBar],
  PbTabs: [() => PbTabs],
  PbToast: [() => PbToast],
  TYPE_GLYPHS: [() => TYPE_GLYPHS],
  base: [() => base],
  css: [() => css],
  edgeLayer: [() => edgeLayer],
  html: [() => html],
  inboxShown: [() => inboxShown, v => (inboxShown = v)],
  nothing: [() => nothing],
  pbFloat: [() => pbFloat, v => (pbFloat = v)],
  pbInboxDot: [() => pbInboxDot, v => (pbInboxDot = v)],
  pbInboxPop: [() => pbInboxPop, v => (pbInboxPop = v)],
  reduced: [() => reduced],
  shadowLayer: [() => shadowLayer],
  shaped: [() => shaped],
  typeGlyphHTML: [() => typeGlyphHTML, v => (typeGlyphHTML = v)],
  typeGlyphURL: [() => typeGlyphURL, v => (typeGlyphURL = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const { LitElement, css, html, nothing } = /** @type {any} */ (self).PB_LIT;

const reduced = () =>
  document.documentElement.dataset.motion === 'reduced' ||
  (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* shared look: glass surface, voice font, focus ring */
const base = css`
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
    outline: 3px solid color-mix(in srgb, var(--tc, var(--gold-b)) 70%, white);
    outline-offset: 2px;
  }
`;

/* UI-2: the angular shape every kit part shares. A clip-path clips box-shadows and borders too, so a part is three
   layers, all sized to the host:
     .sh    the shadow: a solid copy of the outline with a drop shadow, clipped to the ring outside the outline (so
            the shadow never darkens glass); a filter on an ancestor would stop the glass blurring what's behind
     .face  the part itself, clipped to the outline (the glass blurs here)
     .edge  the 1 px edge line along the outline, light on top and dark below
   A part names its family by setting --k-clip, --k-edge and --k-ring to that family's polygons (tokens.css, or the
   sheet uiTheme.json makes), and its depth by --k-drop. */
const shaped = css`
  :host {
    position: relative;
    isolation: isolate;
    --k-drop: var(--drop-raised);
  }
  .sh,
  .edge {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .sh {
    z-index: var(--z-below);
    clip-path: var(--k-ring);
    filter: var(--k-drop);
  }
  .sh::before {
    content: '';
    position: absolute;
    inset: 0;
    clip-path: var(--k-clip);
    background: #000;
  }
  .face {
    position: relative;
    clip-path: var(--k-clip);
  }
  .edge {
    z-index: 2;
    clip-path: var(--k-edge);
    background: var(--edge);
  }
`;
/* the three layers' markup around a part's content */
const shadowLayer = () => html`<span class="sh" part="shadow" aria-hidden="true"></span>`;
const edgeLayer = () => html`<span class="edge" part="edge" aria-hidden="true"></span>`;

const PbPanel = class extends LitElement {
  static properties = { depth: { reflect: true } };
  static styles = [
    base,
    shaped,
    css`
      :host {
        display: block;
        --k-clip: var(--clip-panel);
        --k-edge: var(--edge-panel);
        --k-ring: var(--ring-panel);
      }
      .face {
        height: 100%;
        padding: var(--pad-panel);
        background: var(--g-bg);
        -webkit-backdrop-filter: var(--g-blur);
        backdrop-filter: var(--g-blur);
      }
      :host([depth='float']) {
        --k-drop: var(--drop-float);
      }
      :host([depth='flat']) .sh {
        display: none;
      }
      :host([depth='flat']) .face {
        background: var(--g-bg2);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
    `,
  ];
  constructor() {
    super();
    this.depth = 'raised';
  }
  render() {
    return html`${shadowLayer()}
      <div class="face" part="face"><slot></slot></div>
      ${edgeLayer()}`;
  }
};

/* a card inside a panel: solid semigloss (no blur), four small cuts, a gold notch on the left when selected */
const PbCard = class extends LitElement {
  static properties = {
    selected: { type: Boolean, reflect: true },
    depth: { reflect: true },
  };
  static styles = [
    base,
    shaped,
    css`
      :host {
        display: block;
        --k-clip: var(--clip-card);
        --k-edge: var(--edge-card);
        --k-ring: var(--ring-card);
      }
      .face {
        height: 100%;
        padding: var(--s3) var(--s4);
        background: linear-gradient(180deg, color-mix(in srgb, var(--g-solid) 92%, white), var(--g-solid));
      }
      :host([depth='flat']) .sh {
        display: none;
      }
      :host([depth='flat']) .face {
        background: var(--g-bg2);
      }
      .notch {
        position: absolute;
        left: 0;
        top: 50%;
        z-index: 3;
        width: 6px;
        height: min(60%, 32px);
        transform: translateY(-50%);
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
        clip-path: polygon(0 0, 100% 3px, 100% calc(100% - 3px), 0 100%);
        display: none;
      }
      :host([selected]) .notch {
        display: block;
      }
      :host([selected]) .edge {
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
      }
    `,
  ];
  constructor() {
    super();
    this.selected = false;
    this.depth = 'raised';
  }
  render() {
    return html`${shadowLayer()}
      <div class="face" part="face"><slot></slot></div>
      <span class="notch" aria-hidden="true"></span>${edgeLayer()}`;
  }
};

const PbPill = class extends LitElement {
  static properties = { tone: {}, type: { reflect: true } };
  static styles = [
    base,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--s1);
        padding: 3px 10px;
        border-radius: var(--r-pill);
        background: var(--pill, linear-gradient(180deg, var(--gold-a), var(--gold-b)));
        color: var(--pill-ink, #fff);
        font: 600 var(--fs-caption) / 1.2 var(--font-voice);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
        white-space: nowrap;
      }
      /* UI-2: a type pill shows its glyph (game/art/ui/type-*.svg) before the name */
      .glyph {
        width: 8px;
        height: 8px;
        flex: none;
        background: currentColor;
        -webkit-mask: var(--glyph) center / contain no-repeat;
        mask: var(--glyph) center / contain no-repeat;
      }
    `,
  ];
  /* a tone (a type's colour) gets white text; the default gold (Prime, rewards) gets the dark gold ink */
  updated() {
    if (this.tone) {
      this.style.setProperty('--pill', this.tone);
      this.style.removeProperty('--pill-ink');
    } else {
      this.style.removeProperty('--pill');
      this.style.setProperty('--pill-ink', 'var(--goldink, #3a2408)');
    }
    if (this.type) this.style.setProperty('--glyph', `url('${typeGlyphURL(this.type)}')`);
  }
  render() {
    return html`${this.type ? html`<span class="glyph" aria-hidden="true"></span>` : nothing}<slot></slot>`;
  }
};

/* buttons: the main action (gold) is a long hexagon; the others have four small cuts */
const PbButton = class extends LitElement {
  static properties = {
    kind: { reflect: true },
    wide: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  static styles = [
    base,
    shaped,
    css`
      :host {
        display: inline-block;
        --k-clip: var(--clip-button);
        --k-edge: var(--edge-button);
        --k-ring: var(--ring-button);
        transition: transform var(--m-fast) var(--spring);
      }
      :host([kind='gold']) {
        --k-clip: var(--clip-action);
        --k-edge: var(--edge-action);
        --k-ring: var(--ring-action);
      }
      :host([wide]) {
        display: block;
      }
      :host(:active:not([disabled])) {
        transform: scale(0.96);
        transition-duration: 80ms;
      }
      .face {
        width: 100%;
        min-height: var(--tap);
        padding: var(--s2) var(--s4);
        border: 0;
        font: 600 15px/1.2 var(--font-voice);
        color: var(--text);
        background: linear-gradient(180deg, color-mix(in srgb, var(--g-solid) 90%, white), var(--g-solid));
        cursor: pointer;
      }
      :host([kind='gold']) .face {
        padding: var(--s2) calc(var(--s4) + var(--cut-lg));
        color: var(--goldink, #3a2408);
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
      }
      :host([kind='gold']) .edge {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), color-mix(in srgb, var(--gold-b) 60%, #000));
      }
      :host([kind='dark']) .face {
        color: #fff;
        background: #3a2c55;
      }
      :host([kind='dark']) .edge {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(0, 0, 0, 0.4));
      }
      :host([kind='quiet']) .sh {
        display: none;
      }
      :host([kind='quiet']) .face {
        background: color-mix(in srgb, var(--text) 6%, transparent);
        color: var(--text2);
      }
      .face:focus-visible {
        outline: none;
      }
      .face:focus-visible + .sh {
        display: block;
        filter: var(--drop-focus);
      }
      :host([disabled]) {
        opacity: 0.45;
      }
      .face:disabled {
        cursor: default;
      }
      @media (prefers-reduced-motion: reduce) {
        :host(:active:not([disabled])) {
          transform: none;
        }
      }
    `,
  ];
  constructor() {
    super();
    this.kind = '';
    this.wide = false;
    this.disabled = false;
  }
  /* a click on the inner button reaches the page's handler on this element (it carries data-a) */
  render() {
    return html`<button class="face" part="button" ?disabled=${this.disabled}><slot></slot></button
      >${shadowLayer()}${edgeLayer()}`;
  }
};

const PbSheet = class extends LitElement {
  static properties = { open: { type: Boolean, reflect: true }, heading: {}, _drag: { state: true } };
  static styles = [
    base,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: none;
      }
      :host([open]) {
        display: block;
      }
      .scrim {
        position: absolute;
        inset: 0;
        background: var(--scrim);
        animation: fade var(--m-base) var(--ease-out) both;
      }
      /* UI-2: a floating panel, clear of the screen's edges, with the panel's two cuts; it comes in on a diagonal
         wipe (motion.css m-wipe) */
      .frame {
        position: absolute;
        left: 50%;
        bottom: calc(var(--gutter) + env(safe-area-inset-bottom, 0px));
        width: min(calc(100% - 2 * var(--gutter)), 560px);
        isolation: isolate;
        transform: translateX(-50%) translateY(var(--dy, 0px));
        animation: wipe var(--m-slow) var(--ease-out) backwards;
      }
      .sh,
      .edge {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .sh {
        z-index: var(--z-below);
        clip-path: var(--ring-panel);
        filter: var(--drop-float);
      }
      .sh::before {
        content: '';
        position: absolute;
        inset: 0;
        clip-path: var(--clip-panel);
        background: #000;
      }
      .edge {
        z-index: 2;
        clip-path: var(--edge-panel);
        background: var(--edge);
      }
      .sheet {
        max-height: calc(88vh - var(--gutter));
        overflow: auto;
        padding: var(--s3) var(--pad-panel) var(--pad-panel);
        clip-path: var(--clip-panel);
        background: var(--g-solid);
      }
      .grip {
        display: block;
        width: 40px;
        height: 5px;
        margin: 0 auto var(--s4);
        background: var(--line);
        clip-path: polygon(2px 0, calc(100% - 2px) 0, 100% 50%, calc(100% - 2px) 100%, 2px 100%, 0 50%);
        touch-action: none;
        cursor: grab;
      }
      h2 {
        margin: 0 0 var(--s4);
        font: 700 var(--fs-title) / 1.15 var(--font-voice);
      }
      /* motion.css m-wipe: a mask moves along the 45° line; backwards only, so nothing stays on the frame */
      @keyframes wipe {
        from {
          -webkit-mask-image: linear-gradient(135deg, #000 40%, transparent 60%);
          mask-image: linear-gradient(135deg, #000 40%, transparent 60%);
          -webkit-mask-size: 300% 300%;
          mask-size: 300% 300%;
          -webkit-mask-position: 100% 100%;
          mask-position: 100% 100%;
        }
        to {
          -webkit-mask-image: linear-gradient(135deg, #000 40%, transparent 60%);
          mask-image: linear-gradient(135deg, #000 40%, transparent 60%);
          -webkit-mask-size: 300% 300%;
          mask-size: 300% 300%;
          -webkit-mask-position: 0 0;
          mask-position: 0 0;
        }
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .frame {
          animation: fade 120ms linear both;
        }
      }
    `,
  ];
  constructor() {
    super();
    this.open = false;
    this.heading = '';
    this._y0 = null;
    this._onKey = e => {
      if (this.open && e.key === 'Escape') this.close();
    };
  }
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKey);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKey);
  }
  close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('pb-close', { bubbles: true, composed: true }));
  }
  _down(e) {
    this._y0 = e.clientY;
    /** @type {Element} */ (e.target).setPointerCapture(e.pointerId);
  }
  _move(e) {
    if (this._y0 == null) return;
    const dy = Math.max(0, e.clientY - this._y0);
    /** @type {HTMLElement} */ (this.renderRoot.querySelector('.frame')).style.setProperty('--dy', dy + 'px');
  }
  _up(e) {
    if (this._y0 == null) return;
    const dy = e.clientY - this._y0;
    this._y0 = null;
    /** @type {HTMLElement} */ (this.renderRoot.querySelector('.frame')).style.setProperty('--dy', '0px');
    if (dy > 80) this.close();
  }
  render() {
    if (!this.open) return nothing;
    return html`<div class="scrim" @click=${() => this.close()}></div>
      <div class="frame">
        <span class="sh" aria-hidden="true"></span>
        <div class="sheet" role="dialog" aria-modal="true" aria-label=${this.heading || nothing}>
          <span
            class="grip"
            @pointerdown=${this._down}
            @pointermove=${this._move}
            @pointerup=${this._up}
            @pointercancel=${this._up}
          ></span>
          ${this.heading ? html`<h2>${this.heading}</h2>` : nothing}
          <slot></slot>
        </div>
        <span class="edge" aria-hidden="true"></span>
      </div>`;
  }
};

/* the message under the top bar: a long hexagon of glass with a gold diamond */
const PbToast = class extends LitElement {
  static properties = { text: {}, n: { type: Number } };
  static styles = [
    base,
    shaped,
    css`
      :host {
        position: fixed;
        left: 50%;
        top: calc(var(--toast-top, 12px) + env(safe-area-inset-top, 0px));
        z-index: 40;
        max-width: calc(100vw - 2 * var(--gutter));
        transform: translateX(-50%) translateY(var(--dy, 0px));
        touch-action: none;
        animation: drop var(--m-slow) var(--spring) both;
        --k-clip: var(--clip-toast);
        --k-edge: var(--edge-toast);
        --k-ring: var(--ring-toast);
        --k-drop: var(--drop-float);
      }
      .face {
        display: flex;
        align-items: center;
        gap: var(--s2);
        padding: var(--s2) calc(var(--s4) + var(--cut-md)) var(--s2) calc(var(--s2) + var(--cut-md));
        background: var(--g-bg);
        -webkit-backdrop-filter: var(--g-blur);
        backdrop-filter: var(--g-blur);
        font: 600 14.5px/1.3 var(--font-voice);
      }
      .coin {
        flex: none;
        width: 16px;
        height: 16px;
        clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        background: linear-gradient(135deg, #fff4c2 0 22%, #f7cf5e 23% 55%, #e2a12c 56% 80%, #b97a16 81%);
      }
      .n {
        display: inline-block;
        margin-left: var(--s1);
        color: var(--text2);
      }
      @keyframes drop {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-24px) scale(0.92);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        :host {
          animation: none;
        }
      }
    `,
  ];
  constructor() {
    super();
    this.text = '';
    this.n = 1;
    this._y0 = null;
    this.addEventListener('pointerdown', e => {
      this._y0 = e.clientY;
      this.setPointerCapture(e.pointerId);
    });
    this.addEventListener('pointermove', e => {
      if (this._y0 != null) this.style.setProperty('--dy', Math.min(0, e.clientY - this._y0) + 'px');
    });
    const up = e => {
      if (this._y0 == null) return;
      const dy = e.clientY - this._y0;
      this._y0 = null;
      this.style.setProperty('--dy', '0px');
      /* a swipe up, or a tap, dismisses it */
      if (dy < -24 || Math.abs(dy) < 6)
        this.dispatchEvent(new CustomEvent('pb-dismiss', { bubbles: true, composed: true }));
    };
    this.addEventListener('pointerup', up);
    this.addEventListener('pointercancel', up);
  }
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'status');
  }
  /* the count bumps each time the same message comes again */
  updated(changed) {
    const n = this.renderRoot.querySelector('.n');
    if (changed.has('n') && n && !reduced())
      n.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], {
        duration: 240,
        easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
      });
  }
  render() {
    return html`<div class="face">
        <span class="coin" aria-hidden="true"></span><span class="t">${this.text}</span
        >${this.n > 1 ? html`<b class="n">×${this.n}</b>` : nothing}
      </div>
      ${shadowLayer()}${edgeLayer()}`;
  }
};

/* UI-2: a row of tabs (trapezoids). items="team:Team,bag:Bag" or the items property ([{id, label}]); value is the
   open one; picking one sends pb-change with {value}. The arrow keys, Home and End move along the row. */
const PbTabs = class extends LitElement {
  static properties = { items: {}, value: { reflect: true }, label: {} };
  static styles = [
    base,
    css`
      /* min-width 0: in a grid or flex parent the row shrinks and long labels end in … instead of pushing it wider */
      :host {
        display: block;
        min-width: 0;
      }
      .row {
        display: flex;
        min-width: 0;
        gap: 2px;
        border-bottom: 2px solid var(--gold-b);
      }
      button {
        position: relative;
        isolation: isolate;
        flex: 1 1 0;
        min-width: 0;
        min-height: var(--tap);
        padding: var(--s2) calc(var(--s2) + var(--cut-md));
        border: 0;
        background: none;
        color: var(--text2);
        font: 600 15px/1.1 var(--font-voice);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
      }
      button::before,
      button::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: var(--z-below);
        pointer-events: none;
      }
      button::before {
        clip-path: var(--clip-tab);
        background: color-mix(in srgb, var(--text) 7%, transparent);
      }
      button::after {
        clip-path: var(--edge-tab);
        background: var(--edge);
        opacity: 0.6;
      }
      button[aria-selected='true'] {
        color: var(--goldink, #3a2408);
      }
      button[aria-selected='true']::before {
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
      }
      button[aria-selected='true']::after {
        opacity: 1;
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
    this.items = [];
    this.value = '';
    this.label = '';
  }
  get list() {
    const it = this.items;
    if (Array.isArray(it)) return it;
    return String(it || '')
      .split(',')
      .filter(Boolean)
      .map(s => {
        const [id, label] = s.split(':');
        return { id: id.trim(), label: (label || id).trim() };
      });
  }
  pick(id, focus) {
    if (id !== this.value) {
      this.value = id;
      this.dispatchEvent(new CustomEvent('pb-change', { detail: { value: id }, bubbles: true, composed: true }));
    }
    if (focus)
      this.updateComplete.then(() =>
        /** @type {HTMLElement} */ (this.renderRoot.querySelector('[aria-selected="true"]'))?.focus()
      );
  }
  _key(e) {
    const ids = this.list.map(t => t.id),
      i = ids.indexOf(this.value);
    const j = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: ids.length - 1 }[e.key];
    if (j == null || !ids.length) return;
    e.preventDefault();
    this.pick(ids[(j + ids.length) % ids.length], true);
  }
  render() {
    return html`<div class="row" role="tablist" aria-label=${this.label || nothing} @keydown=${this._key}>
      ${this.list.map(
        t =>
          html`<button
            role="tab"
            part="tab"
            aria-selected=${String(t.id === this.value)}
            tabindex=${t.id === this.value ? 0 : -1}
            @click=${() => this.pick(t.id)}
          >
            ${t.label}
          </button>`
      )}
    </div>`;
  }
};

/* UI-2: an angular, segmented bar for HP, XP and stats. kind="hp" takes its colour from how full it is (teal, gold
   under half, red under a quarter); segments="10" draws that many cells */
const PbStatBar = class extends LitElement {
  static properties = {
    value: { type: Number },
    max: { type: Number },
    kind: { reflect: true },
    segments: { type: Number },
    label: {},
  };
  static styles = [
    base,
    css`
      :host {
        display: block;
        --bar-h: 10px;
        --bar-c: var(--c-hp-ok, var(--ok));
      }
      :host([kind='xp']) {
        --bar-h: 6px;
        --bar-c: #4f8fe0;
      }
      :host([kind='stat']) {
        --bar-c: linear-gradient(90deg, var(--gold-a), var(--gold-b));
      }
      .track {
        position: relative;
        height: var(--bar-h);
        clip-path: polygon(var(--bar-h) 0, 100% 0, calc(100% - var(--bar-h)) 100%, 0 100%);
        background: color-mix(in srgb, var(--text) 12%, transparent);
      }
      .fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--bar-c);
        transition: width var(--m-slow) var(--ease-out);
      }
      .fill::after {
        content: '';
        position: absolute;
        inset: 0 0 50% 0;
        background: rgba(255, 255, 255, 0.28);
      }
      .cells {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          90deg,
          transparent 0 calc(var(--cell) - 2px),
          var(--g-solid) calc(var(--cell) - 2px) var(--cell)
        );
        transform: skewX(-45deg);
        transform-origin: 0 100%;
      }
    `,
  ];
  constructor() {
    super();
    this.value = 0;
    this.max = 1;
    this.kind = 'hp';
    this.segments = 0;
    this.label = '';
  }
  render() {
    const p = this.max > 0 ? Math.max(0, Math.min(1, this.value / this.max)) : 0;
    const c =
      this.kind === 'hp' && p < 0.25
        ? 'var(--c-hp-low, var(--red))'
        : this.kind === 'hp' && p < 0.5
          ? 'var(--c-hp-mid, var(--gold-b))'
          : null;
    const n = this.segments > 0 ? this.segments : 0;
    return html`<div
      class="track"
      role="meter"
      aria-label=${this.label || this.kind.toUpperCase()}
      aria-valuemin="0"
      aria-valuemax=${this.max}
      aria-valuenow=${this.value}
    >
      <i class="fill" style="width:${p * 100}%${c ? `;--bar-c:${c}` : ''}"></i>
      ${n > 1 ? html`<i class="cells" style="--cell:${100 / n}%"></i>` : nothing}
    </div>`;
  }
};

/* UI-2: a labelled text field with four small cuts; the input's own input and change events reach the page */
const PbField = class extends LitElement {
  static properties = {
    label: {},
    value: {},
    placeholder: {},
    hint: {},
    error: {},
    type: {},
    disabled: { type: Boolean, reflect: true },
  };
  static styles = [
    base,
    css`
      :host {
        display: block;
      }
      label {
        display: grid;
        gap: var(--s1);
      }
      .k {
        font: 600 var(--fs-caption) / 1.2 var(--font-voice);
        color: var(--text2);
      }
      .box {
        position: relative;
        isolation: isolate;
      }
      .box::before,
      .box::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .box::before {
        z-index: var(--z-below);
        clip-path: var(--clip-button);
        background: color-mix(in srgb, var(--g-solid) 80%, var(--text) 4%);
      }
      .box::after {
        clip-path: var(--edge-button);
        background: linear-gradient(180deg, var(--edge-lo), var(--edge-hi));
      }
      input {
        width: 100%;
        min-height: var(--tap);
        padding: 0 var(--s3);
        border: 0;
        background: none;
        color: var(--text);
        font: 500 var(--fs-body) / 1.2 var(--font-prose);
      }
      input:focus-visible {
        outline: none;
      }
      :host([disabled]) .box {
        opacity: 0.55;
      }
      .box:focus-within::after {
        background: var(--gold-b);
      }
      :host([error]) .box::after {
        background: var(--c-danger, var(--red));
      }
      .hint {
        font: 500 var(--fs-caption) / 1.35 var(--font-prose);
        color: var(--text2);
      }
      .err {
        color: var(--c-danger, var(--red));
      }
    `,
  ];
  constructor() {
    super();
    this.label = '';
    this.value = '';
    this.placeholder = '';
    this.hint = '';
    this.error = '';
    this.type = 'text';
    this.disabled = false;
  }
  _input(e) {
    this.value = e.target.value;
  }
  render() {
    return html`<label
      ><span class="k">${this.label}</span>
      <span class="box"
        ><input
          part="input"
          type=${this.type}
          .value=${this.value ?? ''}
          placeholder=${this.placeholder || nothing}
          ?disabled=${this.disabled}
          aria-invalid=${this.error ? 'true' : 'false'}
          @input=${this._input}
      /></span>
      ${
        this.error
          ? html`<span class="hint err">${this.error}</span>`
          : this.hint
            ? html`<span class="hint">${this.hint}</span>`
            : nothing
      }
    </label>`;
  }
};

/* UI-2: each type's glyph on its pill, 8 × 8 pixel art on the 45° grid (one table, so the game, the Studio and the
   gallery need no files; a type without one shows none) */
const TYPE_GLYPHS = {
  Fire: ['....#...', '...##...', '..###.#.', '..#####.', '.###.##.', '.##..##.', '.##.###.', '..####..'],
  Water: ['...##...', '..####..', '..####..', '.######.', '.#.####.', '.#.####.', '.######.', '..####..'],
  Grass: ['....####', '..######', '.####.##', '.###.###', '.##.####', '.#.####.', '..####..', '.#......'],
  Electric: ['...####.', '..####..', '.####...', '.######.', '...###..', '..###...', '.##.....', '#.......'],
  Ground: ['........', '...##...', '..####..', '.######.', '........', '.######.', '########', '........'],
  Flying: ['#......#', '##....##', '.##..##.', '..####..', '#..##..#', '##....##', '.##..##.', '..####..'],
  Psychic: ['...##...', '..####..', '.##..##.', '##.##.##', '##.##.##', '.##..##.', '..####..', '...##...'],
  Steel: ['.#.##.#.', '########', '.##..##.', '###..###', '###..###', '.##..##.', '########', '.#.##.#.'],
  Dragon: ['#......#', '##....##', '###..###', '########', '.######.', '..####..', '...##...', '...##...'],
  None: ['...##...', '..####..', '.######.', '########', '########', '.######.', '..####..', '...##...'],
};
const GLYPH_URLS = {};
/** a type's glyph as an SVG data URL ('' for a type with none) @param {string} t */
function typeGlyphURL(t) {
  if (t in GLYPH_URLS) return GLYPH_URLS[t];
  const rows = TYPE_GLYPHS[t];
  if (!rows) return (GLYPH_URLS[t] = '');
  let d = '';
  rows.forEach((row, y) => {
    for (const m of row.matchAll(/#+/g)) d += `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><path d="${d}"/></svg>`;
  return (GLYPH_URLS[t] = 'data:image/svg+xml,' + encodeURIComponent(svg));
}
/** the glyph inside a page-side type pill (.chip) @param {string} t */
export function typeGlyphHTML(t) {
  const u = typeGlyphURL(t);
  return u ? `<i class="ty-g" style="--glyph:url('${u}')" aria-hidden="true"></i>` : '';
}

for (const [tag, cls] of /** @type {const} */ ([
  ['pb-panel', PbPanel],
  ['pb-pill', PbPill],
  ['pb-button', PbButton],
  ['pb-sheet', PbSheet],
  ['pb-toast', PbToast],
  ['pb-card', PbCard],
  ['pb-tabs', PbTabs],
  ['pb-stat-bar', PbStatBar],
  ['pb-field', PbField],
]))
  if (!customElements.get(tag)) customElements.define(tag, cls);

/* a number (+$120) rising from an element: feedback where the action happened, instead of a toast */
export function pbFloat(anchor, text, tone) {
  if (!anchor || !anchor.isConnected) return;
  const r = anchor.getBoundingClientRect(),
    el = document.createElement('span');
  el.className = 'pb-float m-float';
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  el.style.left = r.left + r.width / 2 + 'px';
  el.style.top = r.top + 'px';
  if (tone) el.style.color = tone;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), reduced() ? 400 : 1200);
}

/* the inbox dot on the portrait: how many notices wait (0: no dot). The top bar is redrawn often, so the dot pops
   only when the count goes up (pbInboxPop, after the redraw), never on every redraw */
let inboxShown = 0;
export function pbInboxPop(n) {
  const el = document.querySelector('.tb-inbox b');
  if (el && n > inboxShown && !reduced())
    el.animate(
      [
        { transform: 'scale(0.6)', opacity: 0 },
        { transform: 'scale(1.15)', opacity: 1, offset: 0.6 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 420, easing: 'ease-out' }
    );
  inboxShown = n;
}
export function pbInboxDot(n) {
  return n > 0
    ? `<button class="tb-inbox" data-a="inbox" aria-label="${n} ${n === 1 ? 'message' : 'messages'} waiting"><b>${n > 9 ? '9+' : n}</b></button>`
    : '';
}

/* phase 06-4: tab rows answer the arrow keys (and Home and End) like real tabs: focus moves along the row and the tab
   opens, wherever a row of role="tab" buttons is */
document.addEventListener('keydown', ev => {
  const t = /** @type {HTMLElement} */ (ev.target);
  if (!t || !t.matches || !t.matches('[role="tab"]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key))
    return;
  const row = /** @type {HTMLElement[]} */ ([...t.parentElement.querySelectorAll(':scope > [role="tab"]')]).filter(
    b => !(/** @type {HTMLButtonElement} */ (b).disabled)
  );
  const i = row.indexOf(t);
  if (i < 0 || row.length < 2) return;
  const j =
    ev.key === 'Home'
      ? 0
      : ev.key === 'End'
        ? row.length - 1
        : (i + (ev.key === 'ArrowRight' ? 1 : -1) + row.length) % row.length;
  ev.preventDefault();
  row[j].click();
  /* the click may redraw the row: focus the tab in its new place */
  const d = row[j].dataset,
    attr = 'k' in d ? 'k' : 'p' in d ? 'p' : 't' in d ? 't' : null;
  requestAnimationFrame(() => {
    const again =
      attr &&
      document.querySelector(`[role="tab"][data-a="${CSS.escape(d.a || '')}"][data-${attr}="${CSS.escape(d[attr])}"]`);
    /** @type {HTMLElement} */ (again && again.isConnected ? again : row[j]).focus({ preventScroll: true });
  });
});
