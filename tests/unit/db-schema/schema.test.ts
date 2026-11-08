import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(process.cwd(), "prisma", "schema.prisma");

const loadSchema = (): string => readFileSync(SCHEMA_PATH, "utf-8");

/** Returns the body of the `model <name> { ... }` block, or "" when absent. */
const modelBlock = (schema: string, name: string): string => {
  const match = schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\}`));
  return match && match[1] ? match[1] : "";
};

const expectField = (block: string, field: string): void => {
  expect(
    new RegExp(`(?:^|\\n)\\s*${field}\\s+`).test(block),
    `expected field ${field} in model block`,
  ).toBe(true);
};

const expectAttribute = (block: string, field: string, attribute: string): void => {
  const line = block
    .split("\n")
    .find(
      (candidate) =>
        new RegExp(`\\s*${field}\\s+`).test(candidate) && candidate.includes(attribute),
    );
  expect(line, `expected field ${field} to declare ${attribute}`).toBeDefined();
};

/** Returns the first relation line in a model block that targets `target`. */
const relationLineTo = (block: string, target: string): string | undefined =>
  block.split("\n").find((candidate) => new RegExp(`\\b${target}\\s+@relation`).test(candidate));

describe("database schema", () => {
  it("creates a User model with id, email, passwordHash, role", () => {
    const schema = loadSchema();
    const block = modelBlock(schema, "User");

    expect(block, "expected a User model in the schema").not.toBe("");
    expectField(block, "id");
    expectField(block, "email");
    expectField(block, "passwordHash");
    expectField(block, "role");
  });

  it("creates a Guest model linked optionally to a User", () => {
    const schema = loadSchema();
    const block = modelBlock(schema, "Guest");

    expect(block, "expected a Guest model in the schema").not.toBe("");
    expectField(block, "id");
    expectField(block, "userId");
    expectAttribute(block, "userId", "String?");
    expectAttribute(block, "userId", '@map("user_id")');
    expect(
      /\bGuest\?\s*@relation/.test(schema) || /relation\(fields:\s*\[userId\]/.test(block),
      "expected the Guest.user relation to be optional (towards User)",
    ).toBe(true);
  });

  it("creates EloRating and PerformanceRating models linked to a User and keyed per game mode", () => {
    const schema = loadSchema();

    const eloBlock = modelBlock(schema, "EloRating");
    expect(eloBlock, "expected an EloRating model in the schema").not.toBe("");
    expectField(eloBlock, "id");
    expectField(eloBlock, "userId");
    expectField(eloBlock, "mode");
    const eloRelationLine = relationLineTo(eloBlock, "User");
    expect(eloRelationLine, "expected EloRating.user relation to User").toBeDefined();
    expect(eloRelationLine, "expected userId relation field").toContain("fields: [userId]");

    const performanceBlock = modelBlock(schema, "PerformanceRating");
    expect(performanceBlock, "expected a PerformanceRating model in the schema").not.toBe("");
    expectField(performanceBlock, "id");
    expectField(performanceBlock, "userId");
    expectField(performanceBlock, "mode");
    expectField(performanceBlock, "checkoutPct");
    const performanceRelationLine = relationLineTo(performanceBlock, "User");
    expect(
      performanceRelationLine,
      "expected PerformanceRating.user relation to User",
    ).toBeDefined();
    expect(performanceRelationLine, "expected userId relation field").toContain("fields: [userId]");

    // Ratings are tracked per game mode (e.g. 501, 301, cricket): the unique
    // constraint covers the (userId, mode) pair, not userId alone.
    expect(
      /@@unique\(\[\s*userId,\s*mode\s*\]\)/.test(eloBlock),
      "expected a unique (userId, mode) index on EloRating",
    ).toBe(true);
    expect(
      /@@unique\(\[\s*userId,\s*mode\s*\]\)/.test(performanceBlock),
      "expected a unique (userId, mode) index on PerformanceRating",
    ).toBe(true);
  });

  it("creates GameSession model with foreign keys to players and scores", () => {
    const schema = loadSchema();
    const block = modelBlock(schema, "GameSession");

    expect(block, "expected a GameSession model in the schema").not.toBe("");
    expectField(block, "id");
    expectField(block, "playerOneId");
    expectField(block, "playerTwoId");
    expectField(block, "winnerId");

    // Foreign key lines point at the users table.
    expect(
      /GameSession\[\]\s*@relation\("GamesAsPlayerOne"\)/.test(schema),
      "expected User relation GamesAsPlayerOne",
    ).toBe(true);
    expect(
      /GameSession\[\]\s*@relation\("GamesAsPlayerTwo"\)/.test(schema),
      "expected User relation GamesAsPlayerTwo",
    ).toBe(true);
    expect(
      /GameSession\[\]\s*@relation\("GamesAsWinner"\)/.test(schema),
      "expected User relation GamesAsWinner",
    ).toBe(true);

    // Score records reference the session and the player.
    const scoreBlock = modelBlock(schema, "Score");
    expect(scoreBlock, "expected a Score model in the schema").not.toBe("");
    expect(scoreBlock, "expected sessionId FK on Score").toContain("sessionId");
    expect(scoreBlock, "expected userId FK on Score").toContain("userId");
    expect(scoreBlock, "expected points on Score").toContain("points");
  });

  it("creates Friend relationship model (bidirectional)", () => {
    const schema = loadSchema();
    const block = modelBlock(schema, "Friend");

    expect(block, "expected a Friend model in the schema").not.toBe("");
    expectField(block, "requesterId");
    expectField(block, "addresseeId");

    // Both directions of the friendship are addressable from a User.
    expect(
      /Friend\[\]\s*@relation\("FriendRequestsSent"\)/.test(schema),
      "expected User relation FriendRequestsSent",
    ).toBe(true);
    expect(
      /Friend\[\]\s*@relation\("FriendRequestsReceived"\)/.test(schema),
      "expected User relation FriendRequestsReceived",
    ).toBe(true);

    // The pair is unique and both foreign keys are indexed for lookups
    // in either direction.
    expect(
      /@@unique\(\[requesterId,\s*addresseeId\]\)/.test(block),
      "expected a unique (requesterId, addresseeId) pair",
    ).toBe(true);
    expect(
      /@@index\(\[addresseeId\]\)/.test(block) ||
        /\[userId\]/.test(block) ||
        /@@index\(\[addresseeId,\s*requesterId\]\)/.test(block),
      "expected an index on addresseeId",
    ).toBe(true);
  });

  it("creates CareerQuest model with JSON payload", () => {
    const schema = loadSchema();
    const block = modelBlock(schema, "CareerQuest");

    expect(block, "expected a CareerQuest model in the schema").not.toBe("");
    expectField(block, "id");
    expectField(block, "slug");
    expectField(block, "name");
    expectField(block, "payload");
    expectAttribute(block, "payload", "Json");
  });
});
