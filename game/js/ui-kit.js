'use strict';
/* ================= UI KIT (phase 06) =================
   The shared components every screen builds from (docs/phases/06-plan.md "Structure"), as Lit web components:
     <pb-panel depth="raised|float|flat">   a glass panel that breathes (padding --pad-panel)
     <pb-pill tone="#hex or a var">         a small label (types, counts, badges)
     <pb-button kind="gold|dark|quiet" wide disabled>   a button that presses in; put data-a on the pb-button
     <pb-sheet open heading="...">          a sheet that slides up; drag it down or press Escape to close (pb-close)
     <pb-toast>                             the message pill under the top bar; swipe it up to dismiss (pb-dismiss)
   and two helpers: pbFloat (a number rising from where something happened) and pbInboxDot (the dot on the portrait).
   Lit comes from game/vendor/lit.js (tools/vendor-lit.mjs), a classic script that sets self.PB_LIT. Text in templates is escaped by Lit; never pass markup as
   a string. Colours, sizes and timings come from css/tokens.css; the shadow styles below only read its variables.
   The motions here repeat css/motion.css's keyframes, because a component's own styles can't see the page's. */
/* Lit, from the classic script game/vendor/lit.js (tools/vendor-lit.mjs), loaded before the modules */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
/* eslint-disable no-func-assign */
expose({
  LitElement: [() => LitElement],
  PbButton: [() => PbButton],
  PbPanel: [() => PbPanel],
  PbPill: [() => PbPill],
  PbSheet: [() => PbSheet],
  PbToast: [() => PbToast],
  base: [() => base],
  css: [() => css],
  html: [() => html],
  inboxShown: [() => inboxShown, v => (inboxShown = v)],
  nothing: [() => nothing],
  pbFloat: [() => pbFloat, v => (pbFloat = v)],
  pbInboxDot: [() => pbInboxDot, v => (pbInboxDot = v)],
  pbInboxPop: [() => pbInboxPop, v => (pbInboxPop = v)],
  reduced: [() => reduced],
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

const PbPanel = class extends LitElement {
  static properties = { depth: { reflect: true } };
  static styles = [
    base,
    css`
      :host {
        display: block;
        padding: var(--pad-panel);
        border-radius: var(--r-lg);
        background: var(--g-bg);
        border: 1px solid var(--g-bd);
        box-shadow: var(--depth-raised);
        -webkit-backdrop-filter: var(--g-blur);
        backdrop-filter: var(--g-blur);
      }
      :host([depth='float']) {
        box-shadow: var(--depth-float);
      }
      :host([depth='flat']) {
        box-shadow: none;
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
    return html`<slot></slot>`;
  }
};

const PbPill = class extends LitElement {
  static properties = { tone: {} };
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
  }
  render() {
    return html`<slot></slot>`;
  }
};

const PbButton = class extends LitElement {
  static properties = {
    kind: { reflect: true },
    wide: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  static styles = [
    base,
    css`
      :host {
        display: inline-block;
      }
      :host([wide]) {
        display: block;
      }
      button {
        width: 100%;
        min-height: var(--tap);
        padding: var(--s2) var(--s4);
        border: 0;
        border-radius: var(--r-md);
        font: 600 15px/1.2 var(--font-voice);
        color: var(--text);
        background: var(--g-solid);
        box-shadow: var(--depth-raised);
        cursor: pointer;
        transition: transform var(--m-fast) var(--spring);
      }
      button:active {
        transform: scale(0.96);
        transition-duration: 80ms;
      }
      :host([kind='gold']) button {
        color: var(--goldink, #3a2408);
        background: linear-gradient(180deg, var(--gold-a), var(--gold-b));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.7),
          0 8px 18px -8px var(--gold-sh);
      }
      :host([kind='dark']) button {
        color: #fff;
        background: #3a2c55;
      }
      :host([kind='quiet']) button {
        background: transparent;
        box-shadow: none;
        color: var(--text2);
      }
      button:disabled {
        opacity: 0.45;
        cursor: default;
        transform: none;
      }
      @media (prefers-reduced-motion: reduce) {
        button:active {
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
    return html`<button part="button" ?disabled=${this.disabled}><slot></slot></button>`;
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
      .sheet {
        position: absolute;
        left: 50%;
        bottom: 0;
        width: min(100%, 560px);
        max-height: 88vh;
        overflow: auto;
        transform: translateX(-50%) translateY(var(--dy, 0px));
        padding: var(--s3) var(--pad-panel) calc(var(--pad-panel) + env(safe-area-inset-bottom, 0px));
        border-radius: var(--r-lg) var(--r-lg) 0 0;
        background: var(--g-solid);
        box-shadow: var(--depth-float);
        animation: up var(--m-slow) var(--spring) both;
      }
      .grip {
        display: block;
        width: 40px;
        height: 5px;
        margin: 0 auto var(--s4);
        border-radius: 3px;
        background: var(--line);
        touch-action: none;
        cursor: grab;
      }
      h2 {
        margin: 0 0 var(--s4);
        font: 700 var(--fs-title) / 1.15 var(--font-voice);
      }
      @keyframes up {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(40px);
        }
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sheet {
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
    /** @type {HTMLElement} */ (this.renderRoot.querySelector('.sheet')).style.setProperty('--dy', dy + 'px');
  }
  _up(e) {
    if (this._y0 == null) return;
    const dy = e.clientY - this._y0;
    this._y0 = null;
    /** @type {HTMLElement} */ (this.renderRoot.querySelector('.sheet')).style.setProperty('--dy', '0px');
    if (dy > 80) this.close();
  }
  render() {
    if (!this.open) return nothing;
    return html`<div class="scrim" @click=${() => this.close()}></div>
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
      </div>`;
  }
};

const PbToast = class extends LitElement {
  static properties = { text: {}, n: { type: Number } };
  static styles = [
    base,
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
      }
      .pill {
        display: flex;
        align-items: center;
        gap: var(--s2);
        padding: var(--s2) var(--s4) var(--s2) var(--s2);
        border-radius: var(--r-pill);
        background: var(--g-bg);
        border: 1px solid var(--g-bd);
        box-shadow: var(--depth-float);
        -webkit-backdrop-filter: var(--g-blur);
        backdrop-filter: var(--g-blur);
        font: 600 14.5px/1.3 var(--font-voice);
      }
      .coin {
        flex: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: radial-gradient(circle at 38% 34%, #fff4c2 0 2px, #f7cf5e 3px 5px, #e2a12c 6px 7px, #b97a16 8px);
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
    return html`<div class="pill">
      <span class="coin" aria-hidden="true"></span><span class="t">${this.text}</span
      >${this.n > 1 ? html`<b class="n">×${this.n}</b>` : nothing}
    </div>`;
  }
};

for (const [tag, cls] of /** @type {const} */ ([
  ['pb-panel', PbPanel],
  ['pb-pill', PbPill],
  ['pb-button', PbButton],
  ['pb-sheet', PbSheet],
  ['pb-toast', PbToast],
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
