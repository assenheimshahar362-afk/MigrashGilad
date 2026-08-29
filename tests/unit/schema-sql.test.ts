import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A static read of the single Supabase schema migration.
 *
 * The unit suite does not execute Postgres. This guards the one class of
 * mistake that `create function` cannot catch for us: PL/pgSQL bodies are not
 * planned at creation time, so a type error can install cleanly and only raise
 * when the function is called.
 */
const supabaseDirectory = fileURLToPath(new URL('../../supabase', import.meta.url));
const migrationPath = resolve(
  supabaseDirectory,
  'migrations',
  '00000000000000_init.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

function listSqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listSqlFiles(path) : path.endsWith('.sql') ? [path] : [];
  });
}

/** Every `status` column in the schema and the enum type it holds. */
const ENUM_STATUS_COLUMNS = {
  access_requests: 'access_request_status',
  booking_requests: 'request_status',
  events: 'event_status',
} as const;

describe('init.sql enum assignments', () => {
  it('keeps exactly one baseline migration and one seed file', () => {
    const files = listSqlFiles(supabaseDirectory)
      .map((path) => relative(supabaseDirectory, path).replaceAll('\\', '/'))
      .sort();

    expect(files).toEqual(['migrations/00000000000000_init.sql', 'seed.sql']);
  });

  it('never drops application tables from the production baseline', () => {
    expect(sql).not.toMatch(/\bdrop\s+table\b/i);
  });

  it('declares every status column as its enum type', () => {
    // Guards the premise of the test below: if one of these were ever widened
    // to `text`, the cast rule would stop applying and this file would be
    // enforcing a rule that no longer exists.
    for (const [table, type] of Object.entries(ENUM_STATUS_COLUMNS)) {
      const create = sql.match(
        new RegExp(`create table if not exists ${table} \\(([\\s\\S]*?)\\n\\);`),
      );
      expect(create, `no create table for ${table}`).not.toBeNull();
      expect(create![1]).toMatch(new RegExp(`status\\s+${type}\\b`));
    }
  });

  it('casts every `case` assigned to an enum status column', () => {
    // A single bare literal (`set status = 'cancelled'`) stays `unknown` and is
    // coerced to the column's own type, so it needs nothing. A `case` whose
    // branches are all bare literals resolves to `text` instead, and Postgres
    // has no implicit text -> enum assignment cast — so it raises 42804 at call
    // time unless the result is cast explicitly. Both occurrences in this file
    // shipped without the cast, which made access-request approval and booking
    // approval fail with a bare 500.
    const assignments = [...sql.matchAll(/set\s+status\s*=\s*([^,\n]*case[^\n]*)/gi)];

    // If this drops to zero the regex has drifted away from the SQL and the
    // test would be silently vacuous.
    expect(assignments.length).toBeGreaterThan(0);

    for (const match of assignments) {
      const expression = match[1] ?? '';
      expect(
        expression,
        `\`case\` assigned to an enum status column without a cast — this raises 42804 at run time:\n  ${expression.trim()}`,
      ).toMatch(/::(access_request_status|request_status|event_status)\b/);
    }
  });
});

describe('booking approval activity description', () => {
  it('copies the normalized manager note into the event and decision', () => {
    const approval = sql.match(
      /create or replace function approve_request\([\s\S]*?(?=create or replace function reject_request\()/i,
    );

    expect(approval, 'approve_request function is missing').not.toBeNull();
    expect(approval![0]).toMatch(/v_note\s*:=\s*nullif\(btrim\(coalesce\(p_note,\s*''\)\),\s*''\)/i);
    expect(approval![0]).toMatch(/insert into events \(title, description,/i);
    expect(approval![0]).toMatch(/values \(r\.requester_name, v_note,/i);
    expect(approval![0]).toMatch(/decision_note\s*=\s*v_note/i);
  });
});
