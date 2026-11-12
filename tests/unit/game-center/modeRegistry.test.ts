import { describe, expect, it } from "vitest";
import { AROUND_THE_CLOCK_TARGETS } from "@/game-engine/modes/AroundTheClockMode";
import { CRICKET_TARGETS, MARKS_TO_CLOSE } from "@/game-engine/modes/CricketMode";
import { SHANGHAI_ROUNDS, roundTarget } from "@/game-engine/modes/ShanghaiMode";
import { Standard501Mode, Standard301Mode } from "@/game-engine/modes/StandardMode";
import type { MutableMatchState } from "@/game-engine/types";
import { MODE_RULES, OUT_RULE_CHOICES } from "@/game-engine/modes/registry";
import type { OutRuleId } from "@/game-engine/types";

/** The start score a mode puts every player on, read from the mode itself. */
function startScoreOf(mode: Standard501Mode | Standard301Mode): number {
  const draft: MutableMatchState = {
    matchId: "probe",
    status: "inProgress",
    players: [{ id: "p", totalPoints: 0 }],
    currentPlayerId: "p",
    throwsInCurrentTurn: 0,
    throwCount: 0,
    throws: [],
    corrections: [],
  };
  mode.initializeMatch(draft);
  return draft.players[0]!.totalPoints;
}

function entry(id: string) {
  const found = MODE_RULES.find((rule) => rule.id === id);
  if (!found) {
    throw new Error(`the registry has no entry for "${id}"`);
  }
  return found;
}

describe("mode registry", () => {
  it("describes every game mode the product ships", () => {
    expect(MODE_RULES.map((rule) => rule.id)).toEqual([
      "501",
      "301",
      "cricket",
      "around-the-clock",
      "shanghai",
    ]);
  });

  it("takes the x01 start scores from the mode instances", () => {
    expect(entry("501").start).toBe(String(startScoreOf(new Standard501Mode())));
    expect(entry("301").start).toBe(String(startScoreOf(new Standard301Mode())));
  });

  it("takes the cricket marks and targets from the mode's own constants", () => {
    const cricket = entry("cricket");

    expect(cricket.winCondition).toBe(`Close ${MARKS_TO_CLOSE} marks to score`);
    // The last cricket target is the bull; the rest run 20 down to 15.
    expect(cricket.targets).toBe(
      `${CRICKET_TARGETS[0]}-${CRICKET_TARGETS[CRICKET_TARGETS.length - 2]} + Bull`,
    );
  });

  it("takes the around-the-clock targets from the mode's own constants", () => {
    const aroundTheClock = entry("around-the-clock");

    // The last target is the bull; the rest run 1 to 20.
    expect(aroundTheClock.targets).toBe(
      `${AROUND_THE_CLOCK_TARGETS[0]}-${AROUND_THE_CLOCK_TARGETS[AROUND_THE_CLOCK_TARGETS.length - 2]}, then Bull`,
    );
  });

  it("takes the shanghai rounds and targets from the mode's own constants", () => {
    const shanghai = entry("shanghai");

    expect(shanghai.targets).toBe(`${roundTarget(1)}-${roundTarget(SHANGHAI_ROUNDS)}`);
  });

  it("links every mode to a route that exists", () => {
    for (const rule of MODE_RULES) {
      expect(rule.href, `${rule.name} must link somewhere`).toMatch(/^\/game/);
    }
  });

  it("names the master out rule by the inner bull it accepts", () => {
    const choice = (id: OutRuleId) => {
      const found = OUT_RULE_CHOICES.find((offered) => offered.id === id);
      if (!found) {
        throw new Error(`the registry offers no "${id}" checkout rule`);
      }
      return found;
    };

    // The master out rule accepts the inner bull (50), never the outer one.
    expect(choice("master").description).toContain("inner bull (50)");
    expect(choice("master").description).not.toMatch(/\bthe bull\b/);
    expect(choice("double").description).toBe("finish on a double");
    expect(choice("straight").description).toBe("any finish counts");
  });
});
