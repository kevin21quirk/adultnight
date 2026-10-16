import { NextResponse } from "next/server";
import { z } from "zod";
import { ageMode, createAgeToken, AGE_COOKIE } from "@/lib/age-gate";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

const dobSchema = z.object({
  day: z.coerce.number().int().min(1).max(31),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1900).max(2100),
});

function ageOn(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

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

  const parsed = dobSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid date of birth." },
      { status: 400 }
    );
  }
  const { day, month, year } = parsed.data;
  const dob = new Date(Date.UTC(year, month - 1, day));
  if (dob.getUTCDate() !== day || dob.getUTCMonth() !== month - 1) {
    return NextResponse.json(
      { error: "Enter a valid date of birth." },
      { status: 400 }
    );
  }
  if (dob.getTime() > Date.now() || ageOn(dob, new Date()) < 18) {
    return NextResponse.json(
      { error: "You must be 18 or older to enter this site." },
      { status: 403 }
    );
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
