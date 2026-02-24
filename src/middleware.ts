import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js Middleware — server-side auth guard for protected routes.
 *
 * Protected routes: /admin, /dashboard
 * - If no session → redirect to / with ?auth=required
 * - If session but not admin → redirect to / with ?auth=forbidden
 *
 * All other routes pass through without any DB hit.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin and /dashboard (and their sub-paths)
  const isProtected =
    pathname.startsWith("/admin") || pathname.startsWith("/dashboard");

  if (!isProtected) return NextResponse.next();

  const res = NextResponse.next();

  // Build a Supabase client that reads/writes cookies for SSR
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 1. Check for a valid session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.email) {
    // No authenticated session — redirect to home
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth", "required");
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Check admin role in user_roles table
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role, is_banned")
    .eq("user_id", session.user.id)
    .single();

  const isAdmin = roleData?.role === "admin" && roleData?.is_banned !== true;

  if (!isAdmin) {
    // Authenticated but not admin — redirect to home
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth", "forbidden");
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
