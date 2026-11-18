import { describe, expect, it } from "vitest";
import { toPublicUser } from "@/auth/publicUser";
import type { UserRow } from "@/auth/repository";

const USER: UserRow = {
  id: "user-1",
  email: "player@darthub.dev",
  passwordHash: "$2b$12$not-a-real-hash-but-a-real-field",
  displayName: "Robin",
  role: "USER",
  createdAt: new Date("2026-01-02T03:04:05.000Z"),
  updatedAt: new Date("2026-01-02T03:04:05.000Z"),
};

describe("toPublicUser", () => {
  it("carries the fields a client may see", () => {
    const publicUser = toPublicUser(USER);

    expect(publicUser.id).toBe("user-1");
    expect(publicUser.email).toBe("player@darthub.dev");
    expect(publicUser.displayName).toBe("Robin");
    expect(publicUser.role).toBe("USER");
    expect(publicUser.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("never carries the password hash", () => {
    const publicUser = toPublicUser(USER);

    expect(Object.keys(publicUser)).not.toContain("passwordHash");
    expect(JSON.stringify(publicUser)).not.toContain("$2b$");
    expect(JSON.stringify(publicUser)).not.toContain("not-a-real-hash");
  });

  it("names every field it sends — a field that is not named cannot leak", () => {
    // The answer is built from the list of public fields, so a column that
    // is added to the user row does not appear in it.
    const userWithExtraField = { ...USER, unusedColumn: "should not travel" } as UserRow;

    expect(JSON.stringify(toPublicUser(userWithExtraField))).not.toContain("unusedColumn");
  });
});
