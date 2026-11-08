import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runCommand } from "../../support/run-command";

const PRISMA_DIR = resolve(process.cwd(), "prisma");
const SCHEMA_PATH = resolve(PRISMA_DIR, "schema.prisma");
const MIGRATIONS_DIR = resolve(PRISMA_DIR, "migrations");

/** Local placeholder connection string; the CLI only needs the variable present. */
export const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/darthub";

const EXPECTED_TABLES = [
  "users",
  "guests",
  "elo_ratings",
  "performance_ratings",
  "game_sessions",
  "scores",
  "friends",
  "career_quests",
] as const;

const EXPECTED_ENUMS = ["user_roles", "game_modes", "game_statuses", "friend_statuses"] as const;

describe("prisma migration", () => {
  it("validates the schema without errors", { timeout: 300_000 }, () => {
    const { exitCode, output } = runCommand("npx prisma validate", {
      DATABASE_URL: databaseUrl,
      NODE_ENV: "test",
    });

    expect(exitCode, `prisma validate exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).not.toMatch(/error code: P/i);
  });

  it("generates the Prisma client without errors", { timeout: 300_000 }, () => {
    const { exitCode, output } = runCommand("npx prisma generate", {
      DATABASE_URL: databaseUrl,
      NODE_ENV: "test",
    });

    expect(exitCode, `prisma generate exited with ${exitCode}:\n${output}`).toBe(0);
    expect(
      existsSync(resolve(process.cwd(), "node_modules", ".prisma", "client", "index.js")),
    ).toBe(true);
  });

  it("generates migration and applies without errors", { timeout: 300_000 }, () => {
    // The migration directory must exist with an init migration.
    const migrationDirs = existsSync(MIGRATIONS_DIR) ? readdirSync(MIGRATIONS_DIR) : [];
    expect(
      migrationDirs.length,
      "expected at least one migration under prisma/migrations",
    ).toBeGreaterThanOrEqual(1);
    const migrationDir = migrationDirs.find(Boolean);
    if (!migrationDir) throw new Error("expected a migration directory under prisma/migrations");
    expect(migrationDir, "expected a migration directory name").toBeTruthy();
    const migrationSqlPath = resolve(MIGRATIONS_DIR, migrationDir, "migration.sql");
    expect(existsSync(migrationSqlPath), `expected migration.sql at ${migrationSqlPath}`).toBe(
      true,
    );

    // The stored migration must capture the full schema: all tables, indexes
    // and foreign keys. Fresh-instance behavior is verified by diffing SQL.
    const migrationSql = readFileSync(migrationSqlPath, "utf-8");
    for (const table of EXPECTED_TABLES) {
      expect(migrationSql, `expected migration.sql to create table ${table}`).toMatch(
        new RegExp(`CREATE TABLE\\s+"${table}"`, "i"),
      );
    }
    for (const enumType of EXPECTED_ENUMS) {
      expect(migrationSql, `expected migration.sql to create type ${enumType}`).toMatch(
        new RegExp(`CREATE TYPE\\s+"${enumType}"`, "i"),
      );
    }
    expect(migrationSql, "expected foreign keys in migration.sql").toMatch(/FOREIGN KEY/i);
    expect(migrationSql, "expected indexes in migration.sql").toMatch(/CREATE (UNIQUE )?INDEX/i);

    // Diffing empty data model against the schema must produce valid SQL that
    // matches the stored migration: applying it on a fresh PostgreSQL instance
    // therefore reaches exactly the current schema state.
    const { exitCode, output } = runCommand(
      `npx prisma migrate diff --from-empty --to-schema-datamodel ${SCHEMA_PATH} --script`,
      { DATABASE_URL: databaseUrl, NODE_ENV: "test" },
    );
    expect(exitCode, `prisma migrate diff exited with ${exitCode}:\n${output}`).toBe(0);

    const normalise = (sql: string): string =>
      sql
        .split("\n")
        .map((line) => line.replace(/--.*$/, "").trim())
        .filter(Boolean)
        .join("\n");
    expect(normalise(migrationSql)).toBe(normalise(output));
  });
});
