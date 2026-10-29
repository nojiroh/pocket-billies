// @ts-check
'use strict';
/* ================= LINE MARKUP (dialogue track DL-1) =================
   The bracket tags a spoken line can carry (docs/SCRIPTS.md, "Markup"; docs/phases/dialogue-track.md, "Text that
   acts"). A line may start with an expression and a bubble style, in either order:
     [happy][shout] Get [b]out[/b] of my lab![p] [face=angry]Now.
   parseLine reads it once into its plain text, the effects over ranges of that text, the events at points in it
   (pauses, faces, emotes, stamps, a cut) and its errors. Every surface that doesn't draw effects yet shows `plain`.
   leadingExpr is the one place that reads a line's leading expression (talk.js, script-parse.js, the expressions
   test). Logic only: no DOM, runs in Node (tools/test/line-markup.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { didYouMean } from './conditions.js';
/* eslint-disable no-func-assign */
expose({
  MARKUP_COLOURS: [() => MARKUP_COLOURS],
  MARKUP_EMOTES: [() => MARKUP_EMOTES],
  MARKUP_LEAD_RE: [() => MARKUP_LEAD_RE],
  MARKUP_PAUSE: [() => MARKUP_PAUSE],
  MARKUP_PAUSE_MAX: [() => MARKUP_PAUSE_MAX],
  MARKUP_STAMPS: [() => MARKUP_STAMPS],
  MARKUP_TAGS: [() => MARKUP_TAGS],
  MARKUP_TAG_RE: [() => MARKUP_TAG_RE],
  OPTION_TAGS: [() => OPTION_TAGS],
  // @ts-expect-error -- replaced on purpose
  leadingExpr: [() => leadingExpr, v => (leadingExpr = v)],
  // @ts-expect-error -- replaced on purpose
  markupProblem: [() => markupProblem, v => (markupProblem = v)],
  // @ts-expect-error -- replaced on purpose
  parseLine: [() => parseLine, v => (parseLine = v)],
  // @ts-expect-error -- replaced on purpose
  plainOf: [() => plainOf, v => (plainOf = v)],
  tagShown: [() => tagShown],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const MARKUP_COLOURS = ['gold', 'red', 'teal', 'grey'];
export const MARKUP_EMOTES = ['!', '?', 'sweat', 'anger', 'sparkle', 'note', 'heart'];
export const MARKUP_STAMPS = ['denied', 'approved', 'pending', 'filed', 'void'];
/** the longest pause `[p=…]` may ask for, in seconds, and the default one */
export const MARKUP_PAUSE_MAX = 3,
  MARKUP_PAUSE = 0.4;

/**
 * Every tag. `wrap` tags open and close round some text, `point` tags stand at one place, `style` tags set the
 * bubble's style and only go at the start of a line. `value`: 'none', 'need' (one of `values`, or a check), 'may'.
 * @typedef {{ kind: 'wrap' | 'point' | 'style', value: 'none' | 'need' | 'may', values?: string[], use: string, about: string }} MarkupTag
 * @type {Record<string, MarkupTag>}
 */
export const MARKUP_TAGS = {
  b: { kind: 'wrap', value: 'none', use: '[b]…[/b]', about: 'bold, for the stressed word' },
  i: { kind: 'wrap', value: 'none', use: '[i]…[/i]', about: 'a slant' },
  big: { kind: 'wrap', value: 'none', use: '[big]…[/big]', about: 'bigger' },
  small: { kind: 'wrap', value: 'none', use: '[small]…[/small]', about: 'smaller and fainter' },
  c: {
    kind: 'wrap',
    value: 'need',
    values: MARKUP_COLOURS,
    use: '[c=gold]…[/c]',
    about: 'a colour: gold, red, teal, grey',
  },
  wave: { kind: 'wrap', value: 'none', use: '[wave]…[/wave]', about: 'the letters bob in a wave' },
  shake: { kind: 'wrap', value: 'none', use: '[shake]…[/shake]', about: 'a short jitter' },
  slow: { kind: 'wrap', value: 'none', use: '[slow]…[/slow]', about: 'typed at half speed' },
  fast: { kind: 'wrap', value: 'none', use: '[fast]…[/fast]', about: 'typed at double speed' },
  p: {
    kind: 'point',
    value: 'may',
    use: '[p] or [p=0.8]',
    about: `a pause (${MARKUP_PAUSE} s, or the seconds given, up to ${MARKUP_PAUSE_MAX})`,
  },
  face: { kind: 'point', value: 'need', use: '[face=angry]', about: 'changes the face here (any expression)' },
  emote: {
    kind: 'point',
    value: 'need',
    values: MARKUP_EMOTES,
    use: '[emote=sweat]',
    about: `pops an emote: ${MARKUP_EMOTES.join(' ')}`,
  },
  stamp: {
    kind: 'point',
    value: 'need',
    values: MARKUP_STAMPS,
    use: '[stamp=denied]',
    about: `the Bureau's stamp: ${MARKUP_STAMPS.join(', ')}`,
  },
  cut: { kind: 'point', value: 'none', use: '[cut]', about: 'the line breaks off here (a line ending in — does too)' },
  shout: { kind: 'style', value: 'none', use: '[shout]', about: 'a shouted bubble (at the start of the line)' },
  whisper: { kind: 'style', value: 'none', use: '[whisper]', about: 'a whispered bubble (at the start of the line)' },
  think: { kind: 'style', value: 'none', use: '[think]', about: 'a thought bubble (at the start of the line)' },
  wait: { kind: 'style', value: 'none', use: '[wait]', about: 'a "…" bubble first (at the start of the line)' },
};
/** the tags allowed in a choice's option */
export const OPTION_TAGS = ['b'];

/** a tag as typed: `[name]`, `[/name]`, `[name=value]` */
export const MARKUP_TAG_RE = /\[(\/?)([a-z]+)(?:=([^\]\s]*))?\]/g;
/** a leading `[word]`: an expression or a style */
export const MARKUP_LEAD_RE = /^\[([\w-]+)\]\s*/;

/**
 * The expression and the styles a line starts with, and the rest of it. A leading `[word]` that isn't a tag is the
 * expression (one; a second is left in the text); style tags may come before or after it.
 * @param {string} text
 * @returns {{ expr: string | null, style: string[], rest: string }}
 */
export function leadingExpr(text) {
  let s = String(text || ''),
    expr = /** @type {string | null} */ (null),
    m;
  const style = [];
  while ((m = MARKUP_LEAD_RE.exec(s))) {
    const w = m[1],
      tag = MARKUP_TAGS[w];
    if (tag && tag.kind === 'style') style.push(w);
    else if (!tag && !expr) expr = w;
    else break;
    s = s.slice(m[0].length);
  }
  return { expr, style, rest: s };
}

/** @typedef {Record<string, string | true>} MarkupFx the effects on a letter: { b: true, c: 'gold' } */
/** @typedef {{ at: number, kind: string, v?: string | number }} MarkupEvent */
/**
 * @typedef {{ plain: string, expr: string | null, style: string[], runs: { from: number, to: number, fx: MarkupFx }[],
 *   events: MarkupEvent[], errors: string[] }} ParsedLine
 */

/** `"[name]"`, for messages @param {string} close @param {string} name @param {string} [v] */
export const tagShown = (close, name, v) => `[${close}${name}${v !== undefined ? `=${v}` : ''}]`;

/**
 * A line read into its plain text, effects, events and errors. `runs` and `events` index `plain`. Unknown tags stay
 * in the text as typed (and are an error), so a mistake shows rather than vanishes.
 * @param {string} text
 * @param {{ only?: string[] }} [o] `only`: the tags allowed (a choice's option)
 * @returns {ParsedLine}
 */
export function parseLine(text, o = {}) {
  const { expr, style, rest } = leadingExpr(text),
    errors = /** @type {string[]} */ ([]),
    events = /** @type {MarkupEvent[]} */ ([]),
    open = /** @type {{ t: string, v?: string }[]} */ ([]),
    chars = /** @type {string[]} */ ([]),
    fxs = /** @type {string[]} */ ([]);
  if (o.only && style.length) errors.push(`${tagShown('', style[0])} can't go here`);
  if (new Set(style).size < style.length) errors.push('a style given twice');
  /** the open effects as a key (equal keys merge into one run) */
  const now = () =>
    JSON.stringify(
      Object.fromEntries(open.map(x => [x.t, x.v === undefined ? true : x.v]).sort((a, b) => (a[0] < b[0] ? -1 : 1)))
    );
  const push = (/** @type {string} */ txt) => {
    const f = now();
    for (const ch of txt) {
      // a point tag between two spaces leaves one
      if (ch === ' ' && (chars.length === 0 || chars[chars.length - 1] === ' ')) continue;
      chars.push(ch);
      fxs.push(f);
    }
  };
  let last = 0,
    m;
  MARKUP_TAG_RE.lastIndex = 0;
  while ((m = MARKUP_TAG_RE.exec(rest))) {
    push(rest.slice(last, m.index));
    last = MARKUP_TAG_RE.lastIndex;
    const [all, close, t, v] = m,
      tag = MARKUP_TAGS[t];
    if (!tag || (o.only && !o.only.includes(t))) {
      if (!tag) {
        const near = didYouMean(t, Object.keys(MARKUP_TAGS));
        errors.push(
          `unknown tag "${tagShown(close, t, v)}"${near ? `, did you mean "${tagShown(close, near)}"?` : ''}`
        );
      } else errors.push(`"${tagShown(close, t, v)}" can't go here (only ${o.only?.map(n => `[${n}]`).join(', ')})`);
      push(all);
      continue;
    }
    if (tag.kind === 'style') {
      errors.push(`"${tagShown(close, t)}" goes at the start of the line`);
      continue;
    }
    if (close) {
      if (tag.kind !== 'wrap') errors.push(`"[${t}]" has no closing tag`);
      else if (v !== undefined) errors.push(`"${tagShown(close, t, v)}": a closing tag has no value`);
      else {
        const k = open.map(x => x.t).lastIndexOf(t);
        if (k < 0) errors.push(`"[/${t}]" closes nothing`);
        else if (k < open.length - 1) {
          errors.push(`"[/${t}]" crosses "[${open[open.length - 1].t}]": close "[/${open[open.length - 1].t}]" first`);
          open.splice(k, 1);
        } else open.pop();
      }
      continue;
    }
    // the value
    if (tag.value === 'none' && v !== undefined) {
      errors.push(`"${tagShown('', t, v)}" takes no value: "[${t}]"`);
      continue;
    }
    if (tag.value === 'need' && !v) {
      errors.push(`"[${t}]" needs a value, as in "${tag.use}"`);
      continue;
    }
    if (v && tag.values && !tag.values.includes(v)) {
      const near = didYouMean(v, tag.values);
      errors.push(
        `"${tagShown('', t, v)}": ${near ? `did you mean "${tagShown('', t, near)}"? ` : ''}the choices are ${tag.values.join(', ')}`
      );
      continue;
    }
    if (t === 'face' && v && !/^[\w-]+$/.test(v)) {
      errors.push(`"${tagShown('', t, v)}": a face is a word, as in "[face=angry]"`);
      continue;
    }
    if (t === 'p' && v !== undefined && !(Number.isFinite(+v) && v !== '' && +v >= 0)) {
      errors.push(`"${tagShown('', t, v)}": a pause is a number of seconds, as in "[p=0.8]"`);
      continue;
    }
    if (tag.kind === 'wrap') {
      if (open.some(x => x.t === t)) errors.push(`"[${t}]" is already open`);
      else open.push({ t, v });
    } else
      events.push({
        at: chars.length,
        kind: t,
        ...(t === 'p'
          ? { v: Math.min(MARKUP_PAUSE_MAX, v === undefined ? MARKUP_PAUSE : +v) }
          : v !== undefined
            ? { v }
            : {}),
      });
  }
  push(rest.slice(last));
  if (open.length) errors.push(`not closed: ${open.map(x => `"[${x.t}]"`).join(' ')}`);
  while (chars.length && chars[chars.length - 1] === ' ') {
    chars.pop();
    fxs.pop();
  }
  const plain = chars.join(''),
    n = chars.length;
  for (const e of events) e.at = Math.min(e.at, n);
  if (plain.endsWith('—') && !events.some(e => e.kind === 'cut')) events.push({ at: n, kind: 'cut' });
  /** @type {ParsedLine['runs']} */
  const runs = [];
  for (let i = 0; i < n; i++) {
    if (fxs[i] === '{}') continue;
    const r = runs[runs.length - 1];
    if (r && r.to === i && JSON.stringify(r.fx) === fxs[i]) r.to = i + 1;
    else runs.push({ from: i, to: i + 1, fx: JSON.parse(fxs[i]) });
  }
  return { plain, expr, style, runs, events, errors };
}

/** a line's plain text, with no expression, style or tags (fast when there is no `[`) @param {string} text */
export function plainOf(text) {
  const s = String(text ?? '');
  return s.includes('[') ? parseLine(s).plain : s;
}

/** the first problem with a line's markup, or '' @param {string} text @param {{ only?: string[] }} [o] */
export function markupProblem(text, o) {
  return parseLine(text, o).errors[0] || '';
}
