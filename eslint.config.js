// Phase 04a: ESLint for the game and the Studio.
// The game and the Studio load plain <script> files that share one global scope, in the order of their index.html.
// So each file is linted with the top-level names of the OTHER scripts of its page(s) as globals:
// - no-undef finds a name that no script defines (a typo, a deleted function still called),
// - no-redeclare (builtinGlobals) finds a name defined in two scripts, where the later one silently wins or a
//   let/const stops the page (what tools/check-globals.py looked for line by line).
// Phase 04c: a script may be an ES module (type="module" in the page). In a module no-redeclare can't see a clash
// with another script, so the config itself refuses a name declared by a module and by another script of the same
// page. Phase 04d: a module imports every other module's name it uses (tools/to-module.mjs: from the module, or from
// game/js/hooks.js), so the globals are only the classic scripts' names; no-undef finds a module name read without
// an import (run npm run modules), or read by a classic script.
// Phase 04e: the logic (game/js/logic/) and the data tables it reads (game/js/game-data.js) run in plain Node too
// (tools/check-logic.mjs), so they get no browser globals and import only logic (see isLogic below).
import js from '@eslint/js';
import * as espree from 'espree';
import globals from 'globals';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = import.meta.dirname;
const APPS = ['game/index.html', 'studio/index.html'];

const MODULES = new Set();

// the page's scripts in load order: a file path, or the text of an inline <script>
function scriptsOf(html) {
  const src = readFileSync(join(ROOT, html), 'utf8');
  return [...src.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .map(([, attrs, text]) => {
      const m = attrs.match(/\bsrc="([^"?]+\.js)(?:\?[^"]*)?"/);
      if (!m) return { inline: text };
      if (m[1].includes('://')) return null;
      const file = relative(ROOT, normalize(join(ROOT, dirname(html), m[1])));
      if (/\btype="module"/.test(attrs)) MODULES.add(file);
      return file;
    })
    .filter(Boolean);
}

// every name a script puts in the shared scope: top-level function, class, var, let and const, and
// window.X = / self.X = at the top level (version.js, the art manifests)
function topLevelNames(script) {
  // generated from the data files (tools/build-data.mjs), maybe not made yet: it only sets window.GAMEDATA
  if (script === 'game/data/gamedata.js') return new Set(['GAMEDATA']);
  const text = typeof script === 'string' ? readFileSync(join(ROOT, script), 'utf8') : script.inline;
  const sourceType = MODULES.has(script) ? 'module' : 'script';
  const ast = espree.parse(text, { ecmaVersion: 'latest', sourceType });
  const names = new Set();
  const addPattern = p => {
    if (!p) return;
    if (p.type === 'Identifier') names.add(p.name);
    else if (p.type === 'ObjectPattern')
      p.properties.forEach(q => addPattern(q.type === 'RestElement' ? q.argument : q.value));
    else if (p.type === 'ArrayPattern') p.elements.forEach(addPattern);
    else if (p.type === 'RestElement') addPattern(p.argument);
    else if (p.type === 'AssignmentPattern') addPattern(p.left);
  };
  for (let node of ast.body) {
    if (node.type === 'ExportNamedDeclaration' && node.declaration) node = node.declaration;
    if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) names.add(node.id.name);
    else if (node.type === 'VariableDeclaration') node.declarations.forEach(d => addPattern(d.id));
    else if (node.type === 'ExpressionStatement') {
      for (let e = node.expression; e && e.type === 'AssignmentExpression'; e = e.right) {
        const t = e.left;
        if (t.type === 'MemberExpression' && !t.computed && ['window', 'self'].includes(t.object.name))
          names.add(t.property.name);
      }
      if (node.expression.type === 'SequenceExpression')
        for (const e of node.expression.expressions) {
          const t = e.type === 'AssignmentExpression' && e.left;
          if (t && t.type === 'MemberExpression' && !t.computed && ['window', 'self'].includes(t.object.name))
            names.add(t.property.name);
        }
    }
  }
  return names;
}

// file -> the names the other scripts of its page(s) define
const sharedGlobals = new Map();
const ownNames = new Map();
for (const html of APPS) {
  const scripts = scriptsOf(html);
  const own = new Map(scripts.map(f => [f, topLevelNames(f)]));
  const whose = new Map();
  for (const [f, names] of own)
    for (const n of names) {
      const other = whose.get(n);
      if (other && (MODULES.has(f) || MODULES.has(other)))
        throw new Error(
          `${html}: ${n} is declared in ${typeof other === 'string' ? other : 'an inline script'} and ${f}`
        );
      whose.set(n, f);
    }
  for (const f of scripts.filter(f => typeof f === 'string')) {
    const g = sharedGlobals.get(f) || {};
    // phase 04d: a module's names are not globals (the test globals are only on for the checks), so only the classic
    // scripts' names are; a module reaches another module's names through its imports
    for (const [other, names] of own) if (other !== f && !MODULES.has(other)) for (const n of names) g[n] = 'writable';
    sharedGlobals.set(f, g);
    ownNames.set(f, own.get(f));
  }
}

// Names a module checks for with typeof before use: the Firebase SDK (account.js loads it from the CDN on demand).
const OPTIONAL = { firebase: 'readonly' };

const optionalFor = file => Object.fromEntries(Object.entries(OPTIONAL).filter(([n]) => !ownNames.get(file).has(n)));

// Rules that find bugs. Style is Prettier's job. Off: unused variables (a name another script uses looks unused
// until phase 04c), empty blocks (the code uses catch(e){} on purpose), dead stores and error causes (tidiness).
const bugRules = {
  ...js.configs.recommended.rules,
  'no-redeclare': ['error', { builtinGlobals: true }],
  'no-unused-vars': 'off',
  'no-empty': 'off',
  'no-useless-assignment': 'off',
  'preserve-caught-error': 'off',
  // phase 05 (docs/NAMING.md): camelCase or UPPER_SNAKE names; properties are data keys, so they may be anything.
  // The rest of NAMING.md (no one- or two-letter top-level names, no retired name or prefix, kebab-case files) is
  // tools/check-names.mjs, which npm run lint runs after ESLint
  camelcase: ['error', { properties: 'never', ignoreDestructuring: true, ignoreImports: true }],
};

// Phase 04e: the logic runs in the game and in plain Node (tools/check-logic.mjs, the unit tests), so it may use no
// browser global: no window, document, localStorage, matchMedia, timers or WebGL. Of the classic scripts' names only
// PB_VERSION (game/version.js: a new save's gameVersion; a test sets it). It imports only other logic modules,
// game-data.js (the tables), util.js (random, clamp) and the generated test-globals.js and hooks.js; what it needs
// from the browser side (the save, the battle, toast, render...) it reads through hooks.js, which game-state.js and
// the interface fill on the page and a test fills in Node.
const isLogic = f => f.startsWith('game/js/logic/') || f === 'game/js/game-data.js';
const LOGIC_GLOBALS = { PB_VERSION: 'readonly', console: 'readonly' };
// an import that matches none of these (regular expressions) is an error
const onlyImports = (...allowed) => [
  'error',
  {
    patterns: [
      {
        regex: `^(?!(?:${allowed.join('|')})$)`,
        message: 'the logic imports only logic: game/js/logic/, game-data.js, util.js, hooks.js, test-globals.js',
      },
    ],
  },
];

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'validation/',
      'game/data/',
      'game/art/',
      'firebase/',
      'tools/',
      'docs/',
      '.claude/',
    ],
  },
  ...[...sharedGlobals].map(([file, shared]) => ({
    files: [file],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: MODULES.has(file) ? 'module' : 'script',
      globals: isLogic(file)
        ? Object.fromEntries(Object.entries(LOGIC_GLOBALS).filter(([n]) => n === 'console' || n in shared))
        : { ...globals.browser, ...optionalFor(file), ...shared },
    },
    rules: bugRules,
  })),
  {
    files: ['game/js/logic/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: LOGIC_GLOBALS },
    rules: {
      ...bugRules,
      'no-restricted-imports': onlyImports(
        String.raw`\./[a-z0-9-]+\.js`,
        String.raw`\.\./(?:game-data|util|hooks|test-globals)\.js`
      ),
    },
  },
  {
    files: ['game/js/game-data.js'],
    rules: { 'no-restricted-imports': onlyImports(String.raw`\./(?:util|hooks|test-globals)\.js`) },
  },
  {
    files: ['game/js/test-globals.js', 'game/js/hooks.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
    rules: bugRules,
  },
  {
    files: ['game/sw.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.serviceworker, ...topLevelNamesAsGlobals('game/version.js') },
    },
    rules: bugRules,
  },
  {
    files: ['*.js'],
    languageOptions: { sourceType: 'module', globals: globals.node },
    rules: js.configs.recommended.rules,
  },
];

function topLevelNamesAsGlobals(file) {
  return Object.fromEntries([...topLevelNames(file)].map(n => [n, 'readonly']));
}
