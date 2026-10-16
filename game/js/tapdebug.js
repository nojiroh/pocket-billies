'use strict';
/* alpha 0.4.1: a tap tracer, only when the address ends in ?tapdebug=1. Every touch shows what is under the finger
   (the element the browser hits, its z-order and pointer-events), whether a click followed, and anything that
   cancelled it, in a box at the top of the screen; a screenshot of that box tells what swallows the taps. */
(() => {
  let on = false;
  try {
    on = new URLSearchParams(location.search).get('tapdebug') === '1';
  } catch (e) {}
  if (!on) return;
  const box = document.createElement('pre');
  box.style.cssText =
    'position:fixed;left:4px;right:4px;top:4px;z-index:2147483647;max-height:46vh;overflow:auto;margin:0;padding:6px 8px;font:11px/1.35 monospace;background:rgba(0,0,0,.82);color:#9f9;pointer-events:none;white-space:pre-wrap;border-radius:6px';
  const lines = [],
    say = t => {
      lines.push(t);
      while (lines.length > 24) lines.shift();
      box.textContent = lines.join('\n');
    };
  const desc = el => {
    if (!el || !el.tagName) return String(el);
    const cs = getComputedStyle(el);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}${el.dataset && el.dataset.a ? '[a=' + el.dataset.a + ']' : ''} z${cs.zIndex} pe:${cs.pointerEvents} op:${cs.opacity}`;
  };
  const chain = el => {
    const o = [];
    for (let e = el; e && e !== document.documentElement && o.length < 4; e = e.parentElement) o.push(desc(e));
    return o.join(' < ');
  };
  let t0 = 0;
  addEventListener(
    'pointerdown',
    ev => {
      t0 = performance.now();
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      say(
        `DOWN ${ev.pointerType} @${Math.round(ev.clientX)},${Math.round(ev.clientY)} target=${desc(ev.target)}\n  under: ${chain(hit)}\n  body: ${document.body.className} loader:${!!document.getElementById('loader')}`
      );
    },
    { capture: true, passive: true }
  );
  addEventListener('pointerup', ev => say(`UP ${Math.round(performance.now() - t0)}ms target=${desc(ev.target)}`), {
    capture: true,
    passive: true,
  });
  addEventListener('pointercancel', ev => say('CANCEL (the browser took the touch as a scroll or gesture)'), {
    capture: true,
    passive: true,
  });
  addEventListener('click', ev => say(`CLICK target=${desc(ev.target)}`), { capture: true, passive: true });
  addEventListener(
    'click',
    ev => {
      if (ev.defaultPrevented) say('  click was cancelled by a handler');
    },
    { capture: false, passive: true }
  );
  addEventListener('error', ev => say('ERROR ' + (ev.message || ev.error)), true);
  addEventListener('unhandledrejection', ev => say('PROMISE ERROR ' + ((ev.reason && ev.reason.message) || ev.reason)));
  const add = () => {
    document.body.appendChild(box);
    say('tap tracer on · ' + navigator.userAgent.slice(0, 90));
  };
  if (document.body) add();
  else addEventListener('DOMContentLoaded', add);
})();
