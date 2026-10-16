// Phase 04a: ESLint for the game and the Studio.
// The game and the Studio load plain <script> files that share one global scope, in the order of their index.html.
// So each file is linted with the top-level names of the OTHER scripts of its page(s) as globals:
// - no-undef finds a name that no script defines (a typo, a deleted function still called),
// - no-redeclare (builtinGlobals) finds a name defined in two scripts, where the later one silently wins or a
//   let/const stops the page (what tools/check-globals.py looked for line by line).
// Phase 04c turns the scripts into ES modules; then imports replace this list.
import js from '@eslint/js';
import * as espree from 'espree';
import globals from 'globals';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = import.meta.dirname;
const APPS = ['game/index.html', 'studio/index.html'];

// the page's scripts in load order: a file path, or the text of an inline <script>
function scriptsOf(html) {
  const src = readFileSync(join(ROOT, html), 'utf8');
  return [...src.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .map(([, attrs, text]) => {
      const m = attrs.match(/\bsrc="([^"?]+\.js)(?:\?[^"]*)?"/);
      if (!m) return { inline: text };
      return m[1].includes('://') ? null : relative(ROOT, normalize(join(ROOT, dirname(html), m[1])));
    })
    .filter(Boolean);
}

// every name a script puts in the shared scope: top-level function, class, var, let and const, and
// window.X = / self.X = at the top level (version.js, the art manifests)
function topLevelNames(script) {
  const text = typeof script === 'string' ? readFileSync(join(ROOT, script), 'utf8') : script.inline;
  const ast = espree.parse(text, { ecmaVersion: 'latest', sourceType: 'script' });
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
  for (const node of ast.body) {
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
      sourceType: 'script',
      globals: { ...globals.browser, ...optionalFor(file), ...shared },
    },
    rules: bugRules,
  })),
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
