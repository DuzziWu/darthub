import { describe, expect, it } from "vitest";
import {
  DEFAULT_K_FACTOR,
  DEFAULT_RATING,
  MAX_RATING,
  MIN_RATING,
  clampRating,
  computeEloChange,
  expectedScore,
} from "@/rating/eloService";

describe("Elo rating math", () => {
  it("calculates Elo change after a win/loss using standard K-factor", () => {
    // Two players at 1000 are equally likely to win: expected score 0.5.
    // With K = 32 a win is +16 and a loss is -16.
    expect(expectedScore(DEFAULT_RATING, DEFAULT_RATING)).toBeCloseTo(0.5, 12);
    expect(DEFAULT_K_FACTOR).toBe(32);

    const win = computeEloChange({
      rating: 1000,
      opponentRating: 1000,
      result: "win",
    });
    expect(win.newRating).toBe(1016);
    expect(win.change).toBe(16);
    expect(win.expectedScore).toBeCloseTo(0.5, 12);

    const loss = computeEloChange({
      rating: 1000,
      opponentRating: 1000,
      result: "loss",
    });
    expect(loss.newRating).toBe(984);
    expect(loss.change).toBe(-16);
  });

  it("uses the standard logistic expected-score formula for unequal ratings", () => {
    // Known example: a 2400 player against a 2000 player.
    // expected = 1 / (1 + 10^((2000 - 2400) / 400)) ~= 0.9091
    const expected = expectedScore(2400, 2000);
    expect(expected).toBeGreaterThan(0.909);
    expect(expected).toBeLessThan(0.9092);

    // The favourites' gain is small: 32 * (1 - 0.9091) ~= 2.91 -> +3.
    const favouriteWin = computeEloChange({ rating: 2400, opponentRating: 2000, result: "win" });
    expect(favouriteWin.change).toBe(3);
    expect(favouriteWin.newRating).toBe(2403);
  });

  it("keeps paired win/loss changes symmetric so rating points cancel out", () => {
    const winner = computeEloChange({ rating: 1213, opponentRating: 1447, result: "win" });
    const loser = computeEloChange({ rating: 1447, opponentRating: 1213, result: "loss" });
    expect(winner.change + loser.change).toBeCloseTo(0, 9);
  });

  it("clamps ratings to sane bounds to guard against overflow", () => {
    const clamped = computeEloChange({
      rating: 1000,
      opponentRating: 1000,
      result: "win",
      kFactor: 200,
      minRating: 1001,
      maxRating: 1010,
    });
    // Raw 1000 + 200 would exceed the configured ceiling; clamped instead.
    expect(clamped.newRating).toBe(1010);
    expect(MIN_RATING).toBeLessThan(MAX_RATING);
    expect(clampRating(999_999, MIN_RATING, MAX_RATING)).toBe(MAX_RATING);
    expect(clampRating(-999_999, MIN_RATING, MAX_RATING)).toBe(MIN_RATING);
  });

  it("uses the default bounds to clamp ratings pushed outside the sane range", () => {
    const imported = computeEloChange({
      rating: 5000,
      opponentRating: 1000,
      result: "win",
      kFactor: 200,
    });
    expect(imported.newRating).toBe(MAX_RATING);
  });
});
