import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { AGE_COOKIE } from "@/lib/age-gate";

const AGE_EXEMPT_PREFIXES = [
  "/age-gate",
  "/api/age-gate",
  "/api/report",
  "/admin",
  "/api",
  "/legal",
  "/_next",
  "/favicon",
];

function secret(): Uint8Array | null {
  const s = process.env.AGE_GATE_SECRET || process.env.ADMIN_AUTH_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

async function hasValidAgeToken(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(AGE_COOKIE)?.value;
  const key = secret();
  if (!token || !key) return false;
  try {
    await jwtVerify(token, key);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (AGE_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (await hasValidAgeToken(req)) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = "/age-gate";
  url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
