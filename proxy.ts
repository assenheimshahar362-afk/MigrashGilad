import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * §7: middleware gates /admin/** and additionally the three super-admin-only
 * sections — but middleware is DEFENCE IN DEPTH, not the enforcement point.
 * The authority is RLS and the `security definer` RPCs in the database. If this
 * file were deleted, an admin still could not read the audit log.
 *
 * What middleware genuinely buys us: the session cookie is refreshed here (the
 * only place it can be written before the response streams), and an
 * unauthenticated visitor is bounced before a server component does work.
 *
 * The allowlist role lookup is NOT done here. It needs the service-role key,
 * which does not belong in the edge runtime, and doing it per-request in
 * middleware would double every admin page's database round trips. The layouts
 * under app/(admin) resolve the role server-side instead (§2).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser(), not getSession(): the latter trusts the cookie, this revalidates
  // the JWT against Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && !user) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  // An already-signed-in admin landing on /login goes straight to the queue.
  if (pathname === '/login' && user) {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = '/admin';
    dashboard.search = '';
    return NextResponse.redirect(dashboard);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the service worker and the icons. The
     * public schedule must not pay for an auth round trip (FR-7).
     */
    '/admin/:path*',
    '/login',
  ],
};
