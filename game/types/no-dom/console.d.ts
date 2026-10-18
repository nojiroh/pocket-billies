// Phase 04e: what the logic may use from its host besides the language itself (tsconfig.logic.json, no DOM lib):
// console, which the page and Node both have. Kept out of tsconfig.json, where the DOM lib declares it already.

declare var console: {
  log(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
};
