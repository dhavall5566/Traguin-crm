import { NextRequest, NextResponse } from "next/server";
import { getCrmApiBaseUrl } from "@/lib/api/client";
import { CRM_SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ detail: "Email and password are required." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(`${getCrmApiBaseUrl()}/api/crm/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "Unable to reach the API server. Start the backend on port 8001 and try again." },
      { status: 503 },
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      {
        detail:
          typeof payload?.detail === "string"
            ? payload.detail
            : "Invalid email or password.",
      },
      { status: response.status },
    );
  }

  const accessToken = payload?.access_token;
  const expiresIn = Number(payload?.expires_in ?? 86400);
  if (!accessToken) {
    return NextResponse.json({ detail: "Login failed." }, { status: 502 });
  }

  const nextResponse = NextResponse.json({ ok: true });
  nextResponse.cookies.set(CRM_SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });
  return nextResponse;
}
