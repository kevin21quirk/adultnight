import { NextResponse } from "next/server";
import { ageMode, createAgeToken, AGE_COOKIE } from "@/lib/age-gate";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const mode = ageMode();
  if (mode !== "self_declaration") {
    return NextResponse.json(
      { error: "Age verification method not available." },
      { status: 400 }
    );
  }
  const rl = rateLimit(clientKey(req, "age-gate"), 30, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const token = await createAgeToken(mode);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });
  return res;
}
