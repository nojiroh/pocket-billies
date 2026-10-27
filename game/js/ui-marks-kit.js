'use strict';
/* ================= UI KIT: THE MARKS (UI track UI-14a) =================
   The colour code's marks (docs/phases/ui-track.md Part 2, "The colour code"), as Lit web components like
   js/ui-kit.js and js/ui-run-kit.js. What each mark shows comes from logic/marks.js (the ids, codes, words and
   colours), its glyph from UI-13's art/ui/g-*.svg drawn as a mask (logic/signals.js UI_GLYPHS), its colours from
   UI-11's --sig-* tokens. Every mark has a colour, a shape and a glyph, arrow or code, and its word for screen readers
   (rule 3). Nothing in the game uses them yet: UI-14b puts them on the screens; the gallery shows every state.
     <pb-tag kind="status" mark="brn">                     the angled tag: a status (BRN, PAR, SLP in their colours)
     <pb-tag kind="stat" stat="hus" stages="2">            a boost or drop: ▲ teal or ▼ red first, Atk..Spe, pips
     <pb-tag kind="effect" mark="protect" turns="2">       a short effect: its glyph and the turns left
     <pb-tag kind="more" n="2">                            the row's "+N"
     <pb-chip kind="money" value="340" label="Moneys">    a family-coloured chip with its icon, on pb-coin's API (it
                                                           is a pb-coin: the same count); kind is a currency, a map
                                                           node type or a family; family="" and icon="" override
     <pb-proc mark="perk" text="Quick Laces" stat="hus" stages="1">   the blip when something fires (UI-16b wires it)
     <pb-info open kind="status" mark="brn" line="...">   the explainer a tap opens (long-press in battle): the mark,
                                                           its word and one line; a tap or Escape closes it (pb-close)
     <pb-rarity tier="rare">                               the tier's pill (pb-pick-card's rarity="" shows it too)
   Sized for a battle plate's tag row (16 px tall, 11 px text; UI-15 builds the row, up to 3 and "+N": marks.js
   markRow). Motion is UI-16a/b's: no keyframes or loops here. The Colour shapes switch's patterns come from
   ui-kit.js patternVars. No host-context selectors (Safari ignores them). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { glyphOf, sigVar } from './logic/signals.js';
import { MARK_RARITY, chipLook, rarityTier, tagLook } from './logic/marks.js';
import { LitElement, css, html, nothing, patternVars } from './ui-kit.js';
import { PbCoin, runIconURL, runKitMotion, runNumber } from './ui-run-kit.js';
expose({
  PbChip: [() => PbChip],
  PbInfo: [() => PbInfo],
  PbProc: [() => PbProc],
  PbRarity: [() => PbRarity],
  PbTag: [() => PbTag],
  markGlyph: [() => markGlyph],
  markIcon: [() => markIcon],
  marksBase: [() => marksBase],
});
/* to-module: end */
/* shared: the voice font, a mark's glyph as a mask (base.css .ugl, which can't reach a shadow root), the icon */
const marksBase = css`
  :host {
    box-sizing: border-box;
    font-family: var(--font-voice);
  }
  :host([hidden]) {
    display: none;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  .gl {
    display: inline-block;
    flex: none;
    background-color: var(--tone, currentColor);
    -webkit-mask: var(--ico) center / contain no-repeat;
    mask: var(--ico) center / contain no-repeat;
  }
  .ic {
    display: inline-block;
    flex: none;
    background: var(--ico) center / contain no-repeat;
  }
`;
/** a glyph (art/ui/g-*.svg) as a mask: tint a CSS colour, or '' for the text's colour */
const markGlyph = (/** @type {string} */ icon, size = 10, tint = '') =>
  icon
    ? html`<i
        class="gl"
        style=${`--ico:url('${runIconURL(icon)}');width:${size}px;height:${size}px${tint ? `;--tone:${tint}` : ''}`}
        aria-hidden="true"
      ></i>`
    : nothing;
/** a fixed-colour UI icon (a currency's own art) */
const markIcon = (/** @type {string} */ icon, size = 18) =>
  html`<i class="ic" style=${`--ico:url('${runIconURL(icon)}');width:${size}px;height:${size}px`} aria-hidden="true"></i>`;

/* ---------- the tag: statuses, boosts and drops, short effects, "+N" ---------- */
const PbTag = class extends LitElement {
  static properties = {
    kind: { reflect: true },
    mark: {},
    stat: {},
    stages: { type: Number },
    turns: { type: Number },
    n: { type: Number },
    word: {},
    big: { type: Boolean, reflect: true },
  };
  static styles = [
    marksBase,
    patternVars,
    css`
      :host {
        display: inline-block;
        vertical-align: middle;
        --h: 16px;
        --fs: 11px;
        --gl: 10px;
      }
      :host([big]) {
        --h: 22px;
        --fs: 15px;
        --gl: 14px;
      }
      /* the angled tag: the kit's slant (--clip-chip), its colour code's fill with dark text (ui-track.md: the fills
         are for tags on dark glass, dark text on them); the pattern sits over the fill, under the text */
      .tag {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        height: var(--h);
        padding: 0 calc(var(--h) * 0.4);
        clip-path: var(--clip-chip);
        background: var(--pat, none), var(--fill);
        color: var(--c-ink);
        font-size: var(--fs);
        line-height: 1;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      /* neutral ("+N", a stat back at 0, an unknown mark): the text's colour, faint, as plain chrome */
      .tag.plain {
        background: color-mix(in srgb, currentColor 20%, transparent);
        color: inherit;
      }
      /* a status: its glyph, then the code, a little wider spaced */
      .code {
        letter-spacing: 0.04em;
      }
      /* the arrow comes first and reads before the colour does */
      .arrow {
        font-size: calc(var(--fs) * 0.9);
      }
      .pips {
        display: inline-flex;
        gap: 1px;
        margin-left: 1px;
      }
      .pips i {
        width: 2px;
        height: calc(var(--h) * 0.42);
        background: currentColor;
      }
      .turns {
        margin-left: 1px;
      }
      .in {
        display: contents;
      }
    `,
  ];
  constructor() {
    super();
    this.kind = 'status';
    this.mark = '';
    this.stat = '';
    this.stages = 0;
    this.turns = 0;
    this.n = 0;
    this.word = '';
    this.big = false;
  }
  render() {
    const L = tagLook(this),
      gl = this.big ? 14 : 10,
      style = L.sig ? `--fill:var(${sigVar(L.sig)})${L.pattern ? `;--pat:var(--pat-${L.pattern})` : ''}` : '';
    return html`<span class="tag ${L.sig ? '' : 'plain'}" style=${style} role="img" aria-label=${L.word}
      ><span class="in" aria-hidden="true"
        >${L.arrow ? html`<b class="arrow">${L.arrow}</b>` : nothing}${markGlyph(L.glyph, gl)}${
          L.code ? html`<span class="code">${L.code}</span>` : nothing
        }${
          L.pips ? html`<span class="pips">${Array.from({ length: L.pips }, () => html`<i></i>`)}</span>` : nothing
        }${L.turns ? html`<span class="turns">${L.turns}</span>` : nothing}</span
      ></span
    >`;
  }
};

/* ---------- the chip: currencies, map nodes and messages, on pb-coin's API ---------- */
/* a pb-coin (kind, value, label; the same count to a new value, which UI-16a's tick-ups take over) drawn in its
   family's colour: the tinted face, a bar of the family's fill on the slanted edge, the kind's icon (a currency's
   own, fixed colours) or its family's glyph in the family's text shade. With no value it is a label chip (a node,
   a message) */
const PbChip = class extends PbCoin {
  static properties = { ...PbCoin.properties, family: {}, icon: {}, small: { type: Boolean, reflect: true } };
  static styles = [
    marksBase,
    runKitMotion,
    css`
      :host {
        display: inline-block;
        color: var(--text);
        --h: 32px;
        --fs: 20px;
        --ics: 20px;
      }
      :host([small]) {
        --h: 24px;
        --fs: 15px;
        --ics: 16px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--s2);
        min-height: var(--h);
        padding: var(--s1) calc(var(--s3) + 6px) var(--s1) calc(var(--s2) + 9px);
        clip-path: var(--clip-chip);
        background:
          linear-gradient(90deg, var(--tone, transparent) 0 8px, transparent 8px),
          color-mix(in srgb, var(--tone, var(--c-text)) 16%, var(--c-surface));
        white-space: nowrap;
      }
      .n {
        display: inline-block;
        min-width: 2ch;
        font-size: var(--fs);
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .n.bump {
        animation: m-count var(--m-base) var(--spring);
      }
      .l {
        color: var(--text2);
        font-size: calc(var(--fs) * 0.75);
      }
      .chip.bare .l {
        color: var(--tone-t, var(--text));
        font-size: var(--fs);
      }
    `,
  ];
  constructor() {
    super();
    this.value = /** @type {any} */ (null);
    this.family = '';
    this.icon = '';
    this.small = false;
  }
  render() {
    const self = /** @type {any} */ (this),
      L = chipLook(self.kind, { family: this.family, icon: this.icon }),
      has = self.value != null && Number.isFinite(Number(self.value)),
      name = self.label || self.kind,
      s = this.small ? 16 : 20,
      style = L.sig ? `--tone:var(${sigVar(L.sig)});--tone-t:var(${sigVar(L.sig, true)})` : '';
    return html`<span
      class="chip ${has ? '' : 'bare'}"
      style=${style}
      role="img"
      aria-label=${has ? `${runNumber(self.value)} ${name}` : name}
      >${L.icon ? (L.glyph ? markGlyph(L.icon, s, L.sig ? 'var(--tone-t)' : '') : markIcon(L.icon, s)) : nothing}${
        has
          ? html`<span class="n" aria-hidden="true" @animationend=${e => e.target.classList.remove('bump')}
            >${runNumber(self._shown ?? self.value)}</span
          >`
          : nothing
      }${self.label ? html`<span class="l" aria-hidden="true">${self.label}</span>` : nothing}</span
    >`;
  }
};

/* ---------- the blip: a Perk, held item, trait or type passive firing ---------- */
/* its glyph in its family's colour and a short line ("Quick Laces ▲Spe", "Bubble Wrap −10%") on the battle's dark
   glass. mark: a glyph id in `group` (UI_GLYPHS: kind by default; status, effect, family); family overrides the
   colour; stat and stages add a boost or drop after the line. The look only: UI-16b shows it by a plate when the
   battle reports the trigger */
const PbProc = class extends LitElement {
  static properties = {
    group: {},
    mark: {},
    family: {},
    text: {},
    stat: {},
    stages: { type: Number },
  };
  static styles = [
    marksBase,
    patternVars,
    css`
      :host {
        display: inline-block;
      }
      .proc {
        display: inline-flex;
        align-items: center;
        gap: var(--s1);
        min-height: 24px;
        padding: 2px calc(var(--s2) + 4px) 2px calc(var(--s2) + 6px);
        clip-path: var(--clip-chip);
        background:
          linear-gradient(90deg, var(--tone, transparent) 0 6px, transparent 6px),
          color-mix(in srgb, var(--c-ink) 86%, transparent);
        color: color-mix(in srgb, white 94%, var(--c-ink));
        font-size: 14px;
        line-height: 1;
        white-space: nowrap;
      }
      .st {
        color: var(--st);
      }
    `,
  ];
  constructor() {
    super();
    this.group = 'kind';
    this.mark = '';
    this.family = '';
    this.text = '';
    this.stat = '';
    this.stages = 0;
  }
  render() {
    const G = glyphOf(this.group, this.mark),
      sig = this.family || (G ? G[1] : ''),
      S = this.stat ? tagLook({ kind: 'stat', stat: this.stat, stages: this.stages }) : null,
      word = [this.text, S && S.code ? S.word : ''].filter(Boolean).join(': ');
    return html`<span class="proc" style=${sig ? `--tone:var(${sigVar(sig)})` : ''} role="img" aria-label=${word}
      >${G ? markGlyph(G[0], 14, sig ? `var(${sigVar(sig)})` : '') : nothing}<span aria-hidden="true"
        >${this.text}${
          S && S.arrow
            ? html` <span class="st" style=${`--st:var(${sigVar(S.sig)})`}>${S.arrow}${S.code}</span>`
            : nothing
        }</span
      ></span
    >`;
  }
};

/* ---------- the explainer: the mark, its word and one line ---------- */
/* opened by a tap on a plate or row (long-press in battle: rule 4, glance, tap, sheet); the caller places it. The
   mark is a pb-tag from the same attributes (kind, mark, stat, stages, turns), or whatever is in its "mark" slot (a
   chip). word overrides the tag's word. A tap on it or Escape closes it and sends pb-close */
const PbInfo = class extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    kind: {},
    mark: {},
    stat: {},
    stages: { type: Number },
    turns: { type: Number },
    word: {},
    line: {},
  };
  static styles = [
    marksBase,
    css`
      :host {
        display: block;
        max-width: 280px;
        color: var(--text);
      }
      :host(:not([open])) {
        display: none;
      }
      .info {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: var(--s1) var(--s2);
        padding: var(--s2) var(--s3);
        clip-path: var(--clip-card);
        background: var(--g-solid);
        cursor: pointer;
      }
      .w {
        font-weight: 400;
        font-size: 17px;
        line-height: 1.1;
      }
      .line {
        grid-column: 1 / -1;
        margin: 0;
        color: var(--text2);
        font: 13px / var(--lh-prose) var(--font-prose);
      }
    `,
  ];
  constructor() {
    super();
    this.open = false;
    this.kind = '';
    this.mark = '';
    this.stat = '';
    this.stages = 0;
    this.turns = 0;
    this.word = '';
    this.line = '';
    this._key = (/** @type {KeyboardEvent} */ e) => {
      if (this.open && e.key === 'Escape') this.close();
    };
  }
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._key);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._key);
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('pb-close', { bubbles: true, composed: true }));
  }
  render() {
    const word = this.word || (this.kind ? tagLook(this).word : '');
    return html`<div class="info" role="note" aria-live="polite" @click=${() => this.close()}>
      <span
        ><slot name="mark"
          >${
            this.kind
              ? html`<pb-tag
                big
                kind=${this.kind}
                mark=${this.mark || nothing}
                stat=${this.stat || nothing}
                .stages=${this.stages}
                .turns=${this.turns}
                aria-hidden="true"
              ></pb-tag>`
              : nothing
          }</slot
        ></span
      ><b class="w">${word}</b>
      ${this.line ? html`<p class="line">${this.line}</p>` : nothing}
    </div>`;
  }
};

/* ---------- rarity: the tier's pill ---------- */
/* the loot ladder (the owner's answer 9): common grey, uncommon green, rare blue, mythical orange, the tier's fill
   with dark text. rarities.json's `starter` shows as common (logic/marks.js rarityTier); an unknown tier shows none */
const PbRarity = class extends LitElement {
  static properties = { tier: { reflect: true } };
  static styles = [
    marksBase,
    css`
      :host {
        display: inline-block;
        vertical-align: middle;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        height: 16px;
        padding: 0 7px;
        clip-path: var(--clip-chip);
        background: var(--fill);
        color: var(--c-ink);
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
    `,
  ];
  constructor() {
    super();
    this.tier = '';
  }
  render() {
    const t = rarityTier(this.tier);
    return t ? html`<span class="pill" style=${`--fill:var(${sigVar(t)})`}>${MARK_RARITY[t]}</span>` : nothing;
  }
};

for (const [tag, cls] of /** @type {const} */ ([
  ['pb-tag', PbTag],
  ['pb-chip', PbChip],
  ['pb-proc', PbProc],
  ['pb-info', PbInfo],
  ['pb-rarity', PbRarity],
]))
  if (!customElements.get(tag)) customElements.define(tag, cls);
