import { NextRequest, NextResponse } from "next/server";
import { getCrmApiBaseUrl } from "@/lib/api/client";
import { CRM_SESSION_COOKIE } from "@/lib/auth";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const subPath = path.join("/");
    const base = getCrmApiBaseUrl();
    const url = new URL(`${base}/api/crm/${subPath}`);
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const headers = new Headers();
    headers.set("Accept", "application/json");
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);

    const token = request.cookies.get(CRM_SESSION_COOKIE)?.value;
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const init: RequestInit = {
      method: request.method,
      headers,
      cache: "no-store",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.text();
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), init);
    } catch {
      return NextResponse.json(
        { detail: "Unable to reach the API server. Start the backend on port 8001 and try again." },
        { status: 503 },
      );
    }

    if (response.status === 204 || response.status === 205) {
      return new NextResponse(null, { status: response.status });
    }

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "CRM proxy failed temporarily. Refresh the page and try again." },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
