// Phase 13: reads a debug log a player sent (game/js/log-upload.js) by its code, for the developer. The game can only
// add logs (firestore.rules debugLogs/); this reads them with the admin SDK and a service account's key.
//
//   cd firebase && node fetch-debug-log.mjs K7Q2MX     # writes validation/logs/K7Q2MX.json
//   cd firebase && node fetch-debug-log.mjs --list     # the 20 newest logs: code, when, why, build, size
//
// PB_DEBUG_LOG_KEY holds the service account's JSON key (or the path to the file). Give that account only the
// "Cloud Datastore Viewer" role: it reads, nothing more. Never commit the key.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.PB_DEBUG_LOG_KEY;
if (!raw) {
  console.error('Set PB_DEBUG_LOG_KEY to the service account key (its JSON, or the path to the file).');
  process.exit(1);
}
const key = JSON.parse(raw.trim().startsWith('{') ? raw : readFileSync(raw, 'utf8'));
const db = getFirestore(initializeApp({ credential: cert(key) }));
const arg = process.argv[2] || '';

if (arg === '--list') {
  const snap = await db.collection('debugLogs').orderBy('t', 'desc').limit(20).get();
  for (const d of snap.docs) {
    const x = d.data();
    console.log(
      `${d.id}  ${new Date(x.t).toISOString()}  ${x.why.padEnd(7)}  ${x.build}  ${Math.round(x.size / 1024)} KB`
    );
  }
  if (snap.empty) console.log('No logs yet.');
} else if (/^[A-HJ-NP-Z2-9]{6}$/.test(arg.toUpperCase())) {
  const code = arg.toUpperCase();
  const d = await db.collection('debugLogs').doc(code).get();
  if (!d.exists) {
    console.error(`No log with the code ${code}.`);
    process.exit(1);
  }
  const x = d.data();
  const log = JSON.parse(gunzipSync(Buffer.from(x.gz)).toString('utf8'));
  const dir = new URL('../validation/logs/', import.meta.url);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = new URL(`${code}.json`, dir);
  writeFileSync(out, JSON.stringify(log, null, 1));
  console.log(
    `${code}: ${x.why}, build ${x.build}, sent ${new Date(x.t).toISOString()} -> validation/logs/${code}.json`
  );
} else {
  console.error('Usage: node fetch-debug-log.mjs <CODE> | --list');
  process.exit(1);
}
