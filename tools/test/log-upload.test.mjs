// Phase 13: what a sent debug log holds (game/js/log-upload.js): no picture, no names, no e-mail, gzipped under the
// rules' size limit. Nothing here sends anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { LOG_MAX_BYTES, LOG_SDK_URL, logCode, logGunzip, logNames, logPayload, logScrub } =
  await import('../../game/js/log-upload.js');

const PLANTED = { trainer: 'Quillonda', nick: 'Zorblax' };
const SAVE = { avatar: { name: 'Mirabel' }, team: [{ id: 'sproutle', nick: 'Fernando' }], box: [{ nick: 'Al' }] };
const USER = { name: 'Pat Example', email: 'pat@example.com' };
const LOG = {
  build: '0.1.0-alpha',
  state: { scene: 'marigold' },
  errors: [
    { kind: 'console.warn', msg: '{"avatar":{"name":"Mirabel"},"nick":"fernando"}', stack: 'at Zorblax (x.js:1)' },
    { kind: 'error', msg: 'mail pat@example.com or other@mail.org failed for Pat Example' },
  ],
  events: [[12, 'scene', 'marigold']],
  screenshot: { t: 5, what: 'scene', jpeg: 'data:image/jpeg;base64,AAAA' },
};

test('the names: planted, trainer, nicknames of three letters or more, and the account', () => {
  assert.deepEqual(logNames(SAVE, PLANTED, USER).sort(), [
    'Fernando',
    'Mirabel',
    'Pat Example',
    'Quillonda',
    'Zorblax',
    'pat@example.com',
  ]);
  assert.deepEqual(logNames(null, null, null), []);
});

test('the scrub drops the picture and takes every name and e-mail address out, in any case', () => {
  const out = JSON.stringify(logScrub(LOG, logNames(SAVE, PLANTED, USER)));
  assert.ok(!('screenshot' in JSON.parse(out)));
  for (const n of ['Mirabel', 'fernando', 'Zorblax', 'Pat Example', '@example.com', 'other@mail.org'])
    assert.ok(!out.toLowerCase().includes(n.toLowerCase()), n);
  assert.match(out, /\[name\]/);
  assert.match(out, /\[e-mail\]/);
  assert.match(out, /marigold/, 'place ids stay');
});

test('the payload is the scrubbed log, gzipped, and nothing else', async () => {
  const p = await logPayload(LOG, logNames(SAVE, PLANTED, USER), 'test');
  assert.deepEqual(Object.keys(p).sort(), ['build', 'gz', 'size', 't', 'v', 'why']);
  assert.equal(p.why, 'test');
  assert.ok(p.gz instanceof Uint8Array && p.gz.length < LOG_MAX_BYTES);
  const back = JSON.parse(await logGunzip(p.gz));
  assert.deepEqual(back, logScrub(LOG, logNames(SAVE, PLANTED, USER)));
  assert.equal(p.size, JSON.stringify(back).length);
  assert.equal((await logPayload(LOG, [], 'something else')).why, 'manual');
});

test('a log over the size limit is not sent', async () => {
  let seed = 7;
  const noise = () => (seed = (seed * 16807) % 2147483647).toString(36);
  const big = Object.assign({}, LOG, { events: Array.from({ length: 200000 }, noise) });
  await assert.rejects(logPayload(big, [], 'test'), /too big/);
});

test('codes use the friend-code letters, six of them', () => {
  for (let i = 0; i < 200; i++) assert.match(logCode(), /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(
    logCode(() => 0),
    'AAAAAA'
  );
  assert.equal(
    logCode(() => 0.9999),
    '999999'
  );
});

test('the upload loads the same Firebase SDK as the account', () => {
  const account = readFileSync(new URL('../../game/js/account.js', import.meta.url), 'utf8');
  assert.ok(account.includes(`const FIREBASE_SDK_URL = '${LOG_SDK_URL}';`));
});
