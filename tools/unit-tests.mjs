// Studio plan Phase 6 (T6.4): the unit tests in two tiers. `npm test` runs the quick tier, after every edit (the
// Claude Code hook) and in CI; `npm run test:slow` runs the scene sweeps that generate whole maps and islands (a
// minute of the tier's time between them), in CI beside it. `node tools/unit-tests.mjs all` runs both.
//   node tools/unit-tests.mjs [quick|slow|all] [more node --test flags]
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
// the slowest files (several seconds each, in a cloud container): they generate and walk whole scenes, play runs with
// their scenes, or sweep every roll
export const SLOW_TESTS = [
  'island-gen.test.mjs',
  'island-gen-doors.test.mjs',
  'mapgen-dials.test.mjs',
  'mapgen-grass.test.mjs',
  'mapgen-habitats.test.mjs',
  'mapgen-layout.test.mjs',
  'mapgen-ledges.test.mjs',
  'mapgen-lots.test.mjs',
  'mapgen-mountains.test.mjs',
  'mapgen-pieces.test.mjs',
  'mapgen-roads.test.mjs',
  'mapgen-seams.test.mjs',
  'mapgen-town.test.mjs',
  'route-trainer-spots.test.mjs',
  'run-sim-scenes.test.mjs',
  'run-world-real.test.mjs',
  'weather-before.test.mjs',
];

/* run only as a script: tools/after-edit.mjs imports SLOW_TESTS */
if (process.argv[1] && import.meta.filename === process.argv[1]) main();

function main() {
  const all = (rel = '') =>
    readdirSync(join(ROOT, 'tools/test', rel), { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? all(join(rel, e.name)) : e.name.endsWith('.test.mjs') ? [join(rel, e.name)] : []
    );
  const tier = process.argv[2] || 'quick';
  if (!['quick', 'slow', 'all'].includes(tier)) {
    console.error(`unit-tests: no tier "${tier}" (quick, slow or all)`);
    process.exit(2);
  }
  const files = all()
    .filter(f => tier === 'all' || SLOW_TESTS.includes(f) === (tier === 'slow'))
    .sort()
    .map(f => join('tools/test', f));
  const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(3), ...files], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  process.exit(r.status ?? 1);
}
