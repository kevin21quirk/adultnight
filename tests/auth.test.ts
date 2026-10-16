import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createAgeToken, verifyAgeToken, ageMode } from "@/lib/age-gate";

describe("admin password hashing", () => {
  it("round-trips", () => {
    const h = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
  it("salts differ per hash", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
  });
  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("x", "garbage")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });
});

describe("age gate tokens", () => {
  it("creates and verifies tokens", async () => {
    const t = await createAgeToken("self_declaration");
    expect(await verifyAgeToken(t)).toBe(true);
  });
  it("rejects tampered tokens", async () => {
    expect(await verifyAgeToken("junk.token.here")).toBe(false);
  });
  it("mode resolution", () => {
    expect(["self_declaration", "external", "blocked"]).toContain(ageMode());
  });
});
