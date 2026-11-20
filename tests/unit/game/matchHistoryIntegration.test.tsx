// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { MatchHistory } from "@/components/game/MatchHistory";

/**
 * The history against the engine's own ledger.
 *
 * The history claims to show the visits of the match. That claim is only
 * worth something if the list is the engine's own grouping of the ledger —
 * so this test drives a real engine and compares the two.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/game",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

afterEach(cleanup);

/** An engine with two players and a 501 to start from. */
function makeEngine(): GameEngine {
  const engine = new GameEngine(new StandardMode({ startScore: 501 }));
  engine.startMatch({ playerIds: ["p1", "p2"], outRule: "double" });
  return engine;
}

/** Throws a dart for the player on turn. */
function throwDart(engine: GameEngine, points: number, segment?: "triple" | "double"): void {
  const playerId = engine.getState().currentPlayerId ?? "p1";
  engine.recordThrow({ playerId, points, ...(segment ? { segment } : {}) });
}

describe("the history against the engine", () => {
  it("shows the visits the engine groups out of the ledger", () => {
    const engine = makeEngine();

    // Two full turns: the ledger holds six darts in two visits.
    for (let dart = 0; dart < 6; dart += 1) {
      throwDart(engine, 60, "triple");
    }

    const visits = engine.getVisits();
    expect(visits).toHaveLength(2);

    render(
      <MatchHistory
        visits={visits}
        playerNames={{ p1: "Ann", p2: "Bo" }}
        correctionTarget={null}
        expanded
        onToggle={() => {}}
        onSelectThrow={() => {}}
      />,
    );

    const history = within(screen.getByRole("region", { name: "Match history" }));
    const darts = history
      .getAllByRole("button")
      .filter((button) => (button.getAttribute("aria-label") ?? "").startsWith("History dart"));

    // One button per dart of the whole match — the ledger and the list
    // agree.
    expect(darts).toHaveLength(engine.getState().throws.length);
    expect(history.getByText("2 visits")).toBeTruthy();
  });

  it("names every dart with its index in the ledger", () => {
    const engine = makeEngine();
    for (let dart = 0; dart < 4; dart += 1) {
      throwDart(engine, 60, "triple");
    }

    render(
      <MatchHistory
        visits={engine.getVisits()}
        playerNames={{ p1: "Ann", p2: "Bo" }}
        correctionTarget={null}
        expanded
        onToggle={() => {}}
        onSelectThrow={() => {}}
      />,
    );

    const history = within(screen.getByRole("region", { name: "Match history" }));
    const darts = history
      .getAllByRole("button")
      .filter((button) => (button.getAttribute("aria-label") ?? "").startsWith("History dart"));

    // The last dart of the ledger is the last button of the list, and it
    // carries the ledger's own index.
    const last = darts[darts.length - 1];
    expect(last?.getAttribute("aria-label")).toBe(
      `History dart ${engine.getState().throws.length}: T20`,
    );
  });

  it("hands the ledger index of the chosen dart to the caller", () => {
    const engine = makeEngine();
    for (let dart = 0; dart < 6; dart += 1) {
      throwDart(engine, 60, "triple");
    }

    const selected: number[] = [];
    render(
      <MatchHistory
        visits={engine.getVisits()}
        playerNames={{ p1: "Ann", p2: "Bo" }}
        correctionTarget={null}
        expanded
        onToggle={() => {}}
        onSelectThrow={(index) => selected.push(index)}
      />,
    );

    const history = within(screen.getByRole("region", { name: "Match history" }));
    const darts = history
      .getAllByRole("button")
      .filter((button) => (button.getAttribute("aria-label") ?? "").startsWith("History dart"));

    // The third dart of the list is the dart with the ledger index 2 — the
    // index `correctThrow` takes.
    fireEvent.click(darts[2]!);
    expect(selected).toEqual([2]);
  });

  it("follows a correction: the list is regrouped by the engine", () => {
    const engine = makeEngine();
    for (let dart = 0; dart < 6; dart += 1) {
      throwDart(engine, 60, "triple");
    }

    const before = engine.getVisits();
    expect(before).toHaveLength(2);

    // Correcting the first dart to a different value rewrites the ledger,
    // and the engine groups it again.
    engine.correctThrow(0, { points: 20 });

    const after = engine.getVisits();
    expect(after).toHaveLength(2);
    // The dart carries its new value.
    expect(after[0]?.throws[0]?.points).toBe(20);
  });
});
