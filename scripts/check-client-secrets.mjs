#!/usr/bin/env node
/**
 * NFR-6: no secret appears in any client bundle, enforced by a CI grep step.
 *
 * This runs AFTER `next build` and scans the emitted client JavaScript for the
 * literal values of the server-only environment variables. Grepping for the
 * variable NAME is not enough — bundlers inline values, so the name may be
 * absent while the secret is right there.
 *
 * Exits non-zero on a hit, which fails the build (§7 service role key).
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import process from 'node:process';

/**
 * In CI the secrets are already real environment variables. Locally they live
 * in .env.local, which Node does not read on its own — without this the scan
 * silently degrades to patterns only and reports success against nothing.
 */
async function loadDotEnvLocal() {
  let content;
  try {
    content = await readFile('.env.local', 'utf8');
  } catch {
    return;
  }

  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name]) continue;
    process.env[name] = rawValue.replace(/^["']|["']$/g, '');
  }
}

await loadDotEnvLocal();

const CLIENT_DIRS = ['.next/static', 'public'];

/** Values that must never be reachable from a browser. */
const SECRET_ENV_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'TURNSTILE_SECRET_KEY',
  'VAPID_PRIVATE_KEY',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'IP_HASH_SALT',
  'GOOGLE_CLIENT_SECRET',
  'UPSTASH_REDIS_REST_TOKEN',
];

/** Shapes that are secrets no matter which variable they came from. */
const SECRET_PATTERNS = [
  // A Supabase service-role JWT always carries this role claim.
  { name: 'service_role JWT', regex: /"role"\s*:\s*"service_role"/ },
  { name: 'service_role JWT (encoded)', regex: /ImNlcnZpY2Vfcm9sZSI|InNlcnZpY2Vfcm9sZSI/ },
  { name: 'Resend key', regex: /\bre_[A-Za-z0-9]{16,}\b/ },
];

const SCANNABLE = new Set(['.js', '.mjs', '.cjs', '.map', '.json', '.txt', '.html']);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // Directory absent (e.g. no public/ yet) is not a failure.
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (SCANNABLE.has(extname(entry.name))) {
      yield path;
    }
  }
}

const literals = SECRET_ENV_VARS.map((name) => ({ name, value: process.env[name] })).filter(
  (entry) => entry.value && entry.value.length >= 12,
);

if (literals.length === 0) {
  console.log(
    'check:secrets — no server-only secrets present in the environment; running pattern scan only.',
  );
}

const findings = [];

for (const dir of CLIENT_DIRS) {
  for await (const file of walk(dir)) {
    const content = await readFile(file, 'utf8');

    for (const { name, value } of literals) {
      if (content.includes(value)) {
        findings.push(`${file}: contains the value of ${name}`);
      }
    }

    for (const { name, regex } of SECRET_PATTERNS) {
      if (regex.test(content)) {
        findings.push(`${file}: matches secret pattern "${name}"`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error('\n✖ Secrets found in the client bundle (NFR-6):\n');
  for (const finding of findings) console.error(`  ${finding}`);
  console.error('\nA server-only value has leaked into code shipped to the browser.\n');
  process.exit(1);
}

console.log('✓ check:secrets — no server-only values found in the client bundle.');
