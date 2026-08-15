import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A static read of `supabase/init.sql`.
 *
 * The schema is applied by hand in the Supabase SQL editor, so nothing else in
 * the suite ever executes it — a function body can be wrong for a week and
 * every test here still passes. This guards the one class of mistake that
 * `create function` cannot catch for us: PL/pgSQL bodies are not planned at
 * creation time, so a type error inside one installs cleanly and only raises
 * when the function is finally called, in production, as a bare HTTP 500.
 */
const sql = readFileSync(
  fileURLToPath(new URL('../../supabase/init.sql', import.meta.url)),
  'utf8',
);

/** Every `status` column in the schema and the enum type it holds. */
const ENUM_STATUS_COLUMNS = {
  access_requests: 'access_request_status',
  booking_requests: 'request_status',
  events: 'event_status',
} as const;

describe('init.sql enum assignments', () => {
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
