// @ts-check
'use strict';
/* ===== CASE FILES: THE BUREAU'S EVENTS ON PAPER (style track SY-4) =====
   An event marked `bureau: 1` (events.json) opens as a case file: a manila folder with the Bureau's form number and
   emblem (factions.json bureau.look; an event whose intro names its form says so in `form`), its lines typed in, a few flavour words under redaction bars (the event's
   `redact` list), and the result stamped at the end (an option's `stamp` moment; else the last option, the one that
   walks away, is DENIED and any other is FILED).
   Only flavour words are ever covered: a `redact` word comes from the intro and never from an option, a cost, a
   number or a currency (redactProblem, read by the data check). Options, costs and the summary are never covered.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CASE_TYPE_MS: [() => CASE_TYPE_MS],
  bureauLook: [() => bureauLook],
  // @ts-expect-error -- replaced on purpose
  caseFile: [() => caseFile, v => (caseFile = v)],
  // @ts-expect-error -- replaced on purpose
  caseForm: [() => caseForm, v => (caseForm = v)],
  // @ts-expect-error -- replaced on purpose
  caseStampMoment: [() => caseStampMoment, v => (caseStampMoment = v)],
  // @ts-expect-error -- replaced on purpose
  caseTyped: [() => caseTyped, v => (caseTyped = v)],
  // @ts-expect-error -- replaced on purpose
  redactProblem: [() => redactProblem, v => (redactProblem = v)],
  // @ts-expect-error -- replaced on purpose
  redactSplit: [() => redactSplit, v => (redactSplit = v)],
  wordRe: [() => wordRe],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** how long one letter takes to type in, in ms (a tap shows it all) */
export const CASE_TYPE_MS = 20;

/** the Bureau's look a case file reads (factions.json factions.bureau.look) @param {any} F factions.json
 * @returns {{ emblem: string, stamps: Record<string, string>, forms: string[] } | null} */
export const bureauLook = F => (F && F.factions && F.factions.bureau && F.factions.bureau.look) || null;

/** a form number for an event: the same one every time for the same event @param {string} id
 * @param {string[]} forms @returns {string} */
export function caseForm(id, forms) {
  if (!forms || !forms.length) return '';
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return forms[h % forms.length];
}

/** the case file an event opens as, or null for an event that isn't the Bureau's (or a Bureau with no look)
 * @param {string} id @param {any} ev an events.json event @param {any} F factions.json
 * @returns {{ form: string, emblem: string, stamps: Record<string, string> } | null} */
export function caseFile(id, ev, F) {
  const L = bureauLook(F);
  if (!ev || ev.bureau !== 1 || !L) return null;
  return { form: ev.form || caseForm(id, L.forms), emblem: L.emblem, stamps: L.stamps };
}

/** the moment the end of an event stamps (a look.stamps key) @param {any} ev @param {number} k the option picked */
export function caseStampMoment(ev, k) {
  const o = ev && ev.options && ev.options[k];
  if (o && o.stamp) return o.stamp;
  return ev && ev.options && k === ev.options.length - 1 ? 'denied' : 'filed';
}

/** a whole word (or words) in a line: not inside a longer word @param {string} w */
export const wordRe = w => new RegExp(`(?<![A-Za-z])${w.replace(/[-]/g, '\\-')}(?![A-Za-z])`, 'g');

/** a line cut into plain parts and redacted parts (each word of `words`, wherever it stands as a whole word)
 * @param {string} text @param {string[] | undefined} words @returns {{ t: string, r: boolean }[]} */
export function redactSplit(text, words) {
  /** @type {[number, number][]} */
  const hits = [];
  for (const w of [...(words || [])].sort((a, b) => b.length - a.length))
    for (const m of text.matchAll(wordRe(w))) {
      const a = m.index || 0,
        b = a + w.length;
      if (!hits.some(([x, y]) => a < y && b > x)) hits.push([a, b]);
    }
  hits.sort((p, q) => p[0] - q[0]);
  /** @type {{ t: string, r: boolean }[]} */
  const out = [];
  let at = 0;
  for (const [a, b] of hits) {
    if (a > at) out.push({ t: text.slice(at, a), r: false });
    out.push({ t: text.slice(a, b), r: true });
    at = b;
  }
  if (at < text.length || !out.length) out.push({ t: text.slice(at), r: false });
  return out;
}

/** how many letters show `ms` after the typing began, of `total` @param {number} total @param {number} ms */
export function caseTyped(total, ms) {
  if (!(ms > 0)) return ms === Infinity ? total : 0;
  return Math.min(total, Math.floor(ms / CASE_TYPE_MS));
}

/** why a `redact` word can't be covered ('' when it can): it must be a flavour word of the intro, so letters only,
 * found as a whole word in an intro line, and never a word of an option (its button), a number or a protected word
 * (a currency's name) @param {any} ev @param {string} word @param {Iterable<string>} [guarded] lower case
 * @returns {string} */
export function redactProblem(ev, word, guarded = []) {
  if (!/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/.test(word)) return 'letters only (a flavour word, never a number)';
  if (!(ev.intro || []).some((/** @type {string} */ l) => wordRe(word).test(l))) return 'not a word of the intro';
  const low = word.toLowerCase(),
    parts = low.split(/[ -]/);
  for (const g of guarded)
    if (parts.includes(g) || parts.includes(g + 's')) return `"${g}" is never covered (a cost or an outcome)`;
  for (const o of ev.options || [])
    if (wordRe(low).test(String(o.text).toLowerCase())) return `the option "${o.text}" says it`;
  return '';
}
