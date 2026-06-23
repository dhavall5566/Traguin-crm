import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CRM_LOGIN_PATH, CRM_SESSION_COOKIE } from "@/lib/auth";

function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === CRM_LOGIN_PATH ||
    pathname.startsWith(`${CRM_LOGIN_PATH}/`) ||
    pathname === "/auth/register" ||
    pathname.startsWith("/auth/forgot-password") ||
    pathname.startsWith("/auth/verify-otp") ||
    pathname === "/api/crm/auth/login" ||
    pathname === "/api/crm/auth/logout"
  );
}

function requiresAuth(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/api/crm")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!requiresAuth(pathname) || isPublicAuthPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(CRM_SESSION_COOKIE)?.value;
  if (token) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/crm")) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = CRM_LOGIN_PATH;
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/api/crm/:path*"],
};
