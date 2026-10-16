import { SignJWT, jwtVerify } from "jose";

/**
 * Age-assurance boundary.
 *
 * Modes (env AGE_ASSURANCE_MODE):
 * - "self_declaration": MVP/dev only. An explicit 18+ confirmation sets a
 *   signed cookie. NOT compliant with UK Online Safety Act requirements —
 *   production launch requires "external" mode.
 * - "external": integrate a certified age-assurance provider. The gate page
 *   redirects to AGE_ASSURANCE_URL and the provider calls back to
 *   /api/age-gate/callback with a signed token (AGE_ASSURANCE_CALLBACK_SECRET).
 *   Until a provider is configured, external mode fails closed.
 * - anything else / unset: fails closed in production, falls back to
 *   self_declaration in development only.
 */

export const AGE_COOKIE = "ad_age";
const AGE_TTL = "30d";

export type AgeMode = "self_declaration" | "external" | "blocked";

export function ageMode(): AgeMode {
  const m = process.env.AGE_ASSURANCE_MODE;
  if (m === "external") return "external";
  if (m === "self_declaration") return "self_declaration";
  return process.env.NODE_ENV === "production" ? "blocked" : "self_declaration";
}

function secret(): Uint8Array {
  const s = process.env.AGE_GATE_SECRET || process.env.ADMIN_AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("age gate secret is not configured");
  return new TextEncoder().encode(s);
}

export async function createAgeToken(mode: AgeMode): Promise<string> {
  return new SignJWT({ age: "verified", mode })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(AGE_TTL)
    .sign(secret());
}

export async function verifyAgeToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export function externalProviderUrl(): string | null {
  const u = process.env.AGE_ASSURANCE_URL;
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}
