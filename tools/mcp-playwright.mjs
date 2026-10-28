// Tooling 2026-10-27: Microsoft's Playwright MCP server, set up for this game, so Claude can open it on a phone-sized
// page, tap and type, read the console and take screenshots (.mcp.json starts it; the look skill says how to use it;
// docs/TESTING.md, "Claude Code in the cloud"). What it adds to the server's defaults:
//   - the browser: the cloud image's Chromium (the global Node playwright's executablePath), since the server's own
//     Playwright wants a browser revision the image doesn't have; elsewhere, the server's own choice of Chromium
//   - the checks' launch flags and page set-up from tools/browser_check.py (software WebGL; the clock, no accounts,
//     the test globals, low graphics), so the two can't drift apart
//   - a phone-sized page (390x844, touch, DPR 1 like the checks), 60 s for an action (software drawing is slow),
//     coordinate clicks for the canvas (--caps vision); screenshots and files in validation/mcp/ (gitignored)
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const SERVER = '@playwright/mcp@0.0.83';

/** browser_check.py's launch flags and init scripts, read by Python so this file holds no copy of them */
const check = JSON.parse(
  execFileSync(
    'python3',
    [
      '-I',
      '-c',
      `import json, sys; sys.path.insert(0, ${JSON.stringify(join(ROOT, 'tools'))}); import browser_check as B; ` +
        `print(json.dumps({'args': B.LAUNCH, 'init': [B.CLOCK, B.NO_ACCOUNTS, B.TEST_GLOBALS, B.LOW_GRAPHICS]}))`,
    ],
    { encoding: 'utf8' }
  )
);

/** the cloud image's Chromium: the one its global Node playwright installed, when it is there */
async function imageChromium() {
  try {
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    const { chromium } = await import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
    const path = chromium.executablePath();
    return existsSync(path) ? path : '';
  } catch (e) {
    return '';
  }
}

const dir = mkdtempSync(join(tmpdir(), 'pb-mcp-'));
const out = join(ROOT, 'validation', 'mcp');
mkdirSync(out, { recursive: true });
const executablePath = await imageChromium();
const config = {
  browser: {
    browserName: 'chromium',
    isolated: true,
    launchOptions: { headless: true, args: check.args, ...(executablePath ? { executablePath } : {}) },
    contextOptions: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  },
  outputDir: out,
};
writeFileSync(join(dir, 'config.json'), JSON.stringify(config));
writeFileSync(join(dir, 'init.js'), check.init.join(';\n'));

const args = ['-y', SERVER, '--config', join(dir, 'config.json'), '--init-script', join(dir, 'init.js')];
args.push('--caps', 'vision', '--timeout-action', '60000', '--image-responses', 'allow');
const server = spawn('npx', args, { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
