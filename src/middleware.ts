import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "spa_session";
const PUBLIC = ["/login", "/setup"];

/**
 * First gate: no session cookie → /login (pages) or 401 (API).
 * The session itself is validated against PostgreSQL in requireUser()/apiUser(),
 * so a revoked session is rejected on the next request.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|pwa-icon).*)",
  ],
};
