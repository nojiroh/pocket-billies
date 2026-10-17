// Phase 04a: ESLint for the game and the Studio.
// The game and the Studio load plain <script> files that share one global scope, in the order of their index.html.
// So each file is linted with the top-level names of the OTHER scripts of its page(s) as globals:
// - no-undef finds a name that no script defines (a typo, a deleted function still called),
// - no-redeclare (builtinGlobals) finds a name defined in two scripts, where the later one silently wins or a
//   let/const stops the page (what tools/check-globals.py looked for line by line).
// Phase 04c: a script may be an ES module (type="module" in the page). A module imports what it reads from earlier
// modules (tools/to-module.mjs); everything else it reaches as a global through the window bridge, so it is linted
// with the same list. In a module no-redeclare can't see a clash with another script, so the config itself refuses
// a name declared by a module and by another script of the same page.
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
    for (const [other, names] of own) if (other !== f) for (const n of names) g[n] = 'writable';
    sharedGlobals.set(f, g);
    ownNames.set(f, own.get(f));
  }
}

// Names one page defines and the other checks for with typeof before use: the Studio's art version (the game's
// renderers repaint when it changes), the game's walk hubs (the Studio's preview uses them when present), the Firebase
// SDK (account.js loads it from the CDN on demand).
const OPTIONAL = { dioArtVer: 'readonly', wrHubScene: 'readonly', firebase: 'readonly' };

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
};

export default [
  { ignores: ['node_modules/', 'dist/', 'validation/', 'game/data/', 'game/art/', 'firebase/', 'tools/', 'docs/'] },
  ...[...sharedGlobals].map(([file, shared]) => ({
    files: [file],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: MODULES.has(file) ? 'module' : 'script',
      globals: { ...globals.browser, ...optionalFor(file), ...shared },
    },
    rules: bugRules,
  })),
  {
    files: ['game/js/bridge.js'],
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
