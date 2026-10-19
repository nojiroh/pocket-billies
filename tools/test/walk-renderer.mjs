// Phase 20 C2: loads the walk renderer (game/js/walk-view-gl.js and what it imports) in plain Node, with the few browser
// names its modules touch when they load, and a stand-in WebGL context that records every call made on it. Nothing
// draws; the tests compare what the renderer would have sent to the card.
globalThis.window ??= globalThis;
globalThis.document ??= {
  createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {},
  getElementById: () => null,
  querySelector: () => null,
};
globalThis.PB_TEST_GLOBALS = true;
globalThis.addEventListener ??= () => {};
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });
globalThis.localStorage ??= { getItem: () => null, setItem() {} };
globalThis.requestAnimationFrame ??= () => 0;
globalThis.cancelAnimationFrame ??= () => {};
globalThis.devicePixelRatio ??= 1;

await import('../../game/js/walk-view-gl.js');

// a context whose every method records its name and arguments (typed arrays and arrays copied as plain number lists)
export function recordingGL() {
  const calls = [];
  const copy = a => (ArrayBuffer.isView(a) || Array.isArray(a) ? Array.from(a) : a);
  const gl = new Proxy(
    { calls },
    {
      get(o, k) {
        if (k in o) return o[k];
        if (typeof k !== 'string') return undefined;
        if (/^[A-Z_0-9]+$/.test(k)) return k; // constants: their own name
        return (...args) => {
          calls.push([k, ...args.map(copy)]);
          return null;
        };
      },
    }
  );
  return gl;
}

// a program stand-in: each uniform location is its own name
export const fakeProgram = names => ({ p: 'prog', U: Object.fromEntries(names.map(n => [n, n])) });
