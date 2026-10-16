import { NextResponse } from "next/server";
import { ageMode, createAgeToken, AGE_COOKIE } from "@/lib/age-gate";
import { jwtVerify } from "jose";

/**
 * Callback endpoint for an external age-assurance provider.
 * Expects ?token=<JWT signed with AGE_ASSURANCE_CALLBACK_SECRET>&next=<path>.
 * Boundary stub: until a certified provider is configured this returns 501.
 */
export async function GET(req: Request) {
  if (ageMode() !== "external") {
    return NextResponse.json({ error: "Not configured." }, { status: 501 });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next") || "/";
  const secret = process.env.AGE_ASSURANCE_CALLBACK_SECRET;
  if (!token || !secret) {
    return NextResponse.json({ error: "Invalid callback." }, { status: 400 });
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (payload.result !== "verified") throw new Error("not verified");
  } catch {
    return NextResponse.json({ error: "Verification failed." }, { status: 403 });
  }
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const res = NextResponse.redirect(new URL(safeNext, req.url));
  res.cookies.set(AGE_COOKIE, await createAgeToken("external"), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 30 * 24 * 3600,
  });
  return res;
}
