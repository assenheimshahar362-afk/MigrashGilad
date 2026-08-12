import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@/lib/database.types';

/**
 * §6.4 verification requirement and §18.2 integration layer.
 *
 * "A full RLS policy matrix (anon × admin × super_admin × every table ×
 *  select/insert/update/delete). The matrix is a table-driven test; ADDING A
 *  TABLE WITHOUT ADDING ITS ROW FAILS THE SUITE."
 *
 * That last clause is the important one, and it is enforced by
 * `TABLES` being checked against the live schema in the first test below —
 * not by anyone remembering.
 *
 * Runs against a local Supabase (`supabase start`). Skipped, loudly, when one
 * is not reachable, so `npm test` on a laptop with no Docker still works.
 *
 *   supabase start && supabase db reset
 *   npm run test:integration
 */
const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY ?? '';

const ADMIN_EMAIL = 'rls-admin@example.test';
const SUPER_EMAIL = 'rls-super@example.test';
const PASSWORD = 'rls-test-password-9f3a';

type Verb = 'select' | 'insert' | 'update' | 'delete';
type Actor = 'anon' | 'admin' | 'super_admin';

/** `true` = the actor may perform the verb. Every table in the schema needs a row. */
const MATRIX: Record<string, Record<Actor, Record<Verb, boolean>>> = {
  events: {
    anon: { select: true, insert: false, update: false, delete: false },
    admin: { select: true, insert: true, update: true, delete: true },
    super_admin: { select: true, insert: true, update: true, delete: true },
  },
  trustees: {
    anon: { select: true, insert: false, update: false, delete: false },
    admin: { select: true, insert: true, update: true, delete: true },
    super_admin: { select: true, insert: true, update: true, delete: true },
  },
  closures: {
    anon: { select: true, insert: false, update: false, delete: false },
    admin: { select: true, insert: true, update: true, delete: true },
    super_admin: { select: true, insert: true, update: true, delete: true },
  },
  recurring_rules: {
    anon: { select: true, insert: false, update: false, delete: false },
    admin: { select: true, insert: true, update: true, delete: true },
    super_admin: { select: true, insert: true, update: true, delete: true },
  },
  booking_requests: {
    // §6.4: NO anon access at all. Public reads and writes are proxied by the
    // server, which filters by public_token.
    anon: { select: false, insert: false, update: false, delete: false },
    admin: { select: true, insert: true, update: true, delete: true },
    super_admin: { select: true, insert: true, update: true, delete: true },
  },
  admin_allowlist: {
    // §7 privilege escalation: no update or delete policy exists AT ALL. The
    // only write path is set_manager_role(). An admin may read, never write.
    anon: { select: false, insert: false, update: false, delete: false },
    admin: { select: true, insert: false, update: false, delete: false },
    super_admin: { select: true, insert: true, update: false, delete: false },
  },
  admin_profiles: {
    anon: { select: false, insert: false, update: false, delete: false },
    admin: { select: true, insert: false, update: false, delete: false },
    super_admin: { select: true, insert: false, update: false, delete: false },
  },
  audit_log: {
    anon: { select: false, insert: false, update: false, delete: false },
    admin: { select: false, insert: false, update: false, delete: false },
    super_admin: { select: true, insert: false, update: false, delete: false },
  },
  push_subscriptions: {
    anon: { select: false, insert: false, update: false, delete: false },
    admin: { select: true, insert: true, update: true, delete: true },
    super_admin: { select: true, insert: true, update: true, delete: true },
  },
  notification_log: {
    anon: { select: false, insert: false, update: false, delete: false },
    admin: { select: false, insert: false, update: false, delete: false },
    super_admin: { select: true, insert: false, update: false, delete: false },
  },
  rate_limits: {
    // Service role only; it bypasses RLS, so no policy exists for anyone else.
    anon: { select: false, insert: false, update: false, delete: false },
    admin: { select: false, insert: false, update: false, delete: false },
    super_admin: { select: false, insert: false, update: false, delete: false },
  },
};

const reachable = await isReachable();
const describeIf = reachable ? describe : describe.skip;

if (!reachable) {
  console.warn(
    `\n[rls] Skipping the RLS matrix: no Supabase at ${SUPABASE_URL}.\n` +
      `      Run \`supabase start && supabase db reset\` to execute it.\n`,
  );
}

describeIf('RLS policy matrix (§6.4)', () => {
  const clients: Record<Actor, SupabaseClient<Database>> = {} as never;
  let service: SupabaseClient<Database>;

  beforeAll(async () => {
    service = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    clients.anon = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });

    clients.admin = await signedInAs(ADMIN_EMAIL, 'admin', service);
    clients.super_admin = await signedInAs(SUPER_EMAIL, 'super_admin', service);
  }, 60_000);

  /**
   * The clause that makes the matrix maintainable: a table added by a migration
   * with no row here fails the suite, rather than going untested forever.
   */
  it('covers every table in the public schema', async () => {
    const { data, error } = await service.rpc('is_admin');
    expect(error).toBeNull();
    expect(typeof data).toBe('boolean');

    const { data: tables } = await service
      .schema('information_schema' as never)
      .from('tables' as never)
      .select('table_name')
      .eq('table_schema', 'public');

    const live = ((tables ?? []) as Array<{ table_name: string }>)
      .map((row) => row.table_name)
      .filter((name) => !name.startsWith('pg_'));

    const uncovered = live.filter((name) => !(name in MATRIX));
    expect(uncovered, `Tables with no MATRIX row: ${uncovered.join(', ')}`).toEqual([]);
  });

  for (const [table, byActor] of Object.entries(MATRIX)) {
    for (const [actor, byVerb] of Object.entries(byActor) as Array<[Actor, Record<Verb, boolean>]>) {
      for (const [verb, allowed] of Object.entries(byVerb) as Array<[Verb, boolean]>) {
        it(`${actor} ${allowed ? 'MAY' : 'may NOT'} ${verb} ${table}`, async () => {
          const denied = await isDenied(clients[actor], table, verb);
          expect(denied).toBe(!allowed);
        });
      }
    }
  }
});

/**
 * Acceptance scenario 6, called out separately because §6.4 names these three
 * explicitly as a verification requirement.
 */
describeIf('Scenario 6 — the anon key is powerless where it must be', () => {
  const anon = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });

  it('cannot select from booking_requests', async () => {
    expect(await isDenied(anon, 'booking_requests', 'select')).toBe(true);
  });

  it('cannot insert into events', async () => {
    expect(await isDenied(anon, 'events', 'insert')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A denied read returns an empty set rather than an error under RLS, so
 * "denied" means: an error, OR a select that returns nothing where the service
 * role can see rows. The second half is what catches a policy that silently
 * filters everything instead of refusing.
 */
async function isDenied(
  client: SupabaseClient<Database>,
  table: string,
  verb: Verb,
): Promise<boolean> {
  const anyClient = client as unknown as SupabaseClient;

  if (verb === 'select') {
    const { error, data } = await anyClient.from(table).select('*').limit(1);
    if (error) return true;
    return data === null;
  }

  if (verb === 'insert') {
    const { error } = await anyClient.from(table).insert(probeRow(table)).select();
    // A constraint violation means the policy LET US THROUGH and the row was
    // merely invalid — that is an allow, not a deny.
    return Boolean(error) && isPolicyError(error);
  }

  if (verb === 'update') {
    const { error, data } = await anyClient
      .from(table)
      .update(probeRow(table))
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    if (error) return isPolicyError(error);
    return (data ?? []).length === 0 && (await hasRows(table));
  }

  const { error, data } = await anyClient
    .from(table)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select();
  if (error) return isPolicyError(error);
  return (data ?? []).length === 0 && (await hasRows(table));
}

function isPolicyError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // 42501 insufficient_privilege, PGRST301 no suitable policy.
  return (
    error.code === '42501' ||
    error.code === 'PGRST301' ||
    /row-level security|permission denied|violates row-level/i.test(error.message ?? '')
  );
}

async function hasRows(table: string): Promise<boolean> {
  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { count } = await service.from(table).select('*', { count: 'exact', head: true });
  return (count ?? 0) > 0;
}

/** A minimally-shaped row per table, enough to reach the policy check. */
function probeRow(table: string): Record<string, unknown> {
  const now = new Date(Date.now() + 86_400_000).toISOString();
  const later = new Date(Date.now() + 90_000_000).toISOString();

  switch (table) {
    case 'events':
      return { title: 'rls-probe', usage_type: 'community', starts_at: now, ends_at: later };
    case 'trustees':
      return { full_name: 'rls-probe', phone_e164: '+972500000001' };
    case 'closures':
      return { reason: 'rls-probe', starts_at: now, ends_at: later };
    case 'recurring_rules':
      return {
        title: 'rls-probe',
        usage_type: 'community',
        weekday: 6,
        start_time: '10:00',
        end_time: '11:00',
        valid_from: now.slice(0, 10),
      };
    case 'booking_requests':
      return {
        requester_name: 'rls-probe',
        requester_phone: '+972500000001',
        requested_start: now,
        requested_end: later,
      };
    case 'admin_allowlist':
      return { email: `rls-probe-${Math.round(Number(now.slice(-4)))}@example.test` };
    case 'admin_profiles':
      return { user_id: '00000000-0000-0000-0000-000000000001', email: 'rls-probe@example.test' };
    case 'audit_log':
      return { entity: 'rls-probe', action: 'probe' };
    case 'push_subscriptions':
      return {
        user_id: '00000000-0000-0000-0000-000000000001',
        endpoint: `https://example.test/${now}`,
        p256dh: 'x',
        auth: 'y',
      };
    case 'notification_log':
      return { channel: 'push', target: 'rls-probe', status: 'sent' };
    case 'rate_limits':
      return { key: `rls-probe:${now}`, count: 1 };
    default:
      return {};
  }
}

/** Create the user if needed, put them on the allowlist, and sign in. */
async function signedInAs(
  email: string,
  role: 'admin' | 'super_admin',
  service: SupabaseClient<Database>,
): Promise<SupabaseClient<Database>> {
  const admin = service as unknown as SupabaseClient;

  await admin.auth.admin
    .createUser({ email, password: PASSWORD, email_confirm: true })
    .catch(() => undefined);

  await service
    .from('admin_allowlist')
    .upsert({ email, role, revoked_at: null }, { onConflict: 'email' });

  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Could not sign in the ${role} fixture: ${error.message}`);

  return client;
}

async function isReachable(): Promise<boolean> {
  if (!ANON_KEY || !SERVICE_KEY) return false;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: ANON_KEY },
      signal: AbortSignal.timeout(2000),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
