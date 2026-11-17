import { describe, expect, it } from "vitest";
import { InvalidPasswordError } from "@/auth/errors";
import {
  assertPasswordPolicy,
  isPasswordAcceptable,
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  passwordPolicyViolation,
} from "@/auth/passwordPolicy";

describe("passwordPolicy", () => {
  it("accepts a password that meets the rules", () => {
    expect(isPasswordAcceptable("correct horse battery staple")).toBe(true);
    expect(passwordPolicyViolation("correct horse battery staple")).toBeNull();
  });

  it("refuses a password that is too short", () => {
    expect(passwordPolicyViolation("short")).toBe("too-short");
    expect(passwordPolicyViolation("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe("too-short");
  });

  it("accepts a password of exactly the minimum length", () => {
    expect(passwordPolicyViolation("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("refuses a password that is longer than bcrypt can hash", () => {
    const tooLong = "a".repeat(MAX_PASSWORD_BYTES + 1);

    expect(passwordPolicyViolation(tooLong)).toBe("too-long");
  });

  it("accepts a password of exactly the maximum length", () => {
    expect(passwordPolicyViolation("a".repeat(MAX_PASSWORD_BYTES))).toBeNull();
  });

  it("measures the length in bytes, because that is what bcrypt counts", () => {
    // Thirty-seven two-byte characters are thirty-seven characters but
    // seventy-four bytes — over the limit even though the character count
    // is not.
    const multiByte = "é".repeat(37);

    expect(multiByte.length).toBeLessThan(MAX_PASSWORD_BYTES);
    expect(new TextEncoder().encode(multiByte).length).toBeGreaterThan(MAX_PASSWORD_BYTES);
    expect(passwordPolicyViolation(multiByte)).toBe("too-long");
  });

  it("refuses something that is not a password at all", () => {
    expect(passwordPolicyViolation(undefined)).toBe("not-a-string");
    expect(passwordPolicyViolation(null)).toBe("not-a-string");
    expect(passwordPolicyViolation(12345678)).toBe("not-a-string");
    expect(passwordPolicyViolation({})).toBe("not-a-string");
  });

  it("throws the typed error when it refuses", () => {
    expect(() => assertPasswordPolicy("short")).toThrow(InvalidPasswordError);
    expect(() => assertPasswordPolicy("correct horse battery staple")).not.toThrow();
  });

  it("does not put the password into the error message", () => {
    try {
      assertPasswordPolicy("hunter2-short");
      expect.unreachable("the password should have been refused");
    } catch (error) {
      expect((error as Error).message).not.toContain("hunter2");
    }
  });
});
