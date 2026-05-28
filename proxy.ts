import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAdminPasswordConfigured, isAdminRequestAuthenticated } from "@/lib/admin-auth";

const protectedMatchers = [
  /^\/admin(?:\/.*)?$/,
  /^\/api\/admin(?:\/.*)?$/,
  /^\/api\/run\/full-pipeline$/,
  /^\/api\/ingest\/.+$/,
];

function isProtectedPath(pathname: string) {
  return protectedMatchers.some((matcher) => matcher.test(pathname));
}

function isLoginPath(pathname: string) {
  return pathname === "/admin/login";
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (isLoginPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAdminPasswordConfigured()) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("error", "missing-password");
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRequestAuthenticated(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/run/full-pipeline", "/api/ingest/:path*"],
};
